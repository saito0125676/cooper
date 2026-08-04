import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { parseIsoDateStrict } from "@/lib/dates";
import {
  validateCustomerInfo,
  isCustomerInfoValid,
  type CustomerInfoInput,
} from "@/lib/customerInfo";
import {
  attachCheckoutSession,
  createHold,
  formatReservationDate,
  parseReservationDate,
  releaseHold,
  SoldOutError,
} from "@/lib/reservations";

// デモ用の固定料金(1日あたり)
const CAR_UNIT_PRICE_JPY = 8000;

type CreateReservationBody = { date?: unknown } & Partial<
  Record<keyof CustomerInfoInput, unknown>
>;

const CUSTOMER_INFO_STRING_FIELDS: (keyof CustomerInfoInput)[] = [
  "lastName",
  "firstName",
  "lastNameKana",
  "firstNameKana",
  "birthDate",
  "postalCode",
  "prefecture",
  "city",
  "town",
  "addressLine",
  "mobilePhone",
  "homePhone",
  "email",
  "emailConfirm",
  "licenseNumber",
  "licenseIssuedDate",
];

export async function POST(request: NextRequest) {
  let body: CreateReservationBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストボディがJSONとして解釈できません" },
      { status: 400 }
    );
  }

  if (typeof body.date !== "string") {
    return NextResponse.json({ error: "dateは必須です" }, { status: 400 });
  }

  // homePhone以外はサーバー側でも必須項目として扱う(クライアント側検証のバイパス対策)
  for (const field of CUSTOMER_INFO_STRING_FIELDS) {
    if (typeof body[field] !== "string") {
      return NextResponse.json(
        { error: `${field}は必須です` },
        { status: 400 }
      );
    }
  }

  const customerInfo = Object.fromEntries(
    CUSTOMER_INFO_STRING_FIELDS.map((field) => [field, (body[field] as string).trim()])
  ) as unknown as CustomerInfoInput;

  const customerErrors = validateCustomerInfo(customerInfo);
  if (!isCustomerInfoValid(customerErrors)) {
    return NextResponse.json(
      { error: "入力内容に誤りがあります", fieldErrors: customerErrors },
      { status: 400 }
    );
  }

  let date: Date;
  try {
    date = parseReservationDate(body.date);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  // validateCustomerInfoで実在日付であることは検証済みなので、ここではnullにならない
  const birthDate = parseIsoDateStrict(customerInfo.birthDate)!;
  const licenseIssuedDate = parseIsoDateStrict(customerInfo.licenseIssuedDate)!;

  // 1. 在庫チェック + 2. 仮押さえ作成 (DBトランザクション+ロックで安全に処理)
  let reservationId: string;
  let idempotencyKey: string;
  try {
    const reservation = await createHold({
      date,
      lastName: customerInfo.lastName,
      firstName: customerInfo.firstName,
      lastNameKana: customerInfo.lastNameKana,
      firstNameKana: customerInfo.firstNameKana,
      birthDate,
      postalCode: customerInfo.postalCode,
      prefecture: customerInfo.prefecture,
      city: customerInfo.city,
      town: customerInfo.town,
      addressLine: customerInfo.addressLine,
      mobilePhone: customerInfo.mobilePhone,
      homePhone: customerInfo.homePhone || null,
      email: customerInfo.email,
      licenseNumber: customerInfo.licenseNumber,
      licenseIssuedDate,
    });
    reservationId = reservation.id;
    idempotencyKey = reservation.idempotencyKey;
  } catch (err) {
    if (err instanceof SoldOutError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[reservations] hold creation failed", err);
    return NextResponse.json(
      { error: "予約の作成に失敗しました" },
      { status: 500 }
    );
  }

  // 3. Stripe Checkoutセッションを作成する
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: customerInfo.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "jpy",
              unit_amount: CAR_UNIT_PRICE_JPY,
              product_data: {
                name: `レンタカー予約 ${formatReservationDate(date)}`,
              },
            },
          },
        ],
        // Webhook側で予約行を特定するための紐付け情報
        client_reference_id: reservationId,
        metadata: { reservationId },
        payment_intent_data: { metadata: { reservationId } },
        success_url: `${baseUrl}/success?reservation_id=${reservationId}`,
        cancel_url: `${baseUrl}/cancel?reservation_id=${reservationId}`,
      },
      // 同じ予約に対してこのAPIが(クライアントの再試行などで)複数回呼ばれても
      // Stripe側では同一のCheckout Session/PaymentIntentが返るようにする
      { idempotencyKey }
    );

    await attachCheckoutSession(reservationId, session.id);

    return NextResponse.json(
      { reservationId, checkoutUrl: session.url },
      { status: 201 }
    );
  } catch (err) {
    console.error("[reservations] stripe checkout session creation failed", err);
    // Stripe側が失敗したら仮押さえも解放し、在庫を戻す
    await releaseHold(reservationId);
    return NextResponse.json(
      { error: "決済ページの作成に失敗しました" },
      { status: 502 }
    );
  }
}
