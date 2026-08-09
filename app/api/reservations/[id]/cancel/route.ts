import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { calcRefundRate } from "@/lib/cancellationPolicy";
import { CAR_UNIT_PRICE_JPY } from "@/app/api/reservations/route";
import {
  ReservationStatus,
  PaymentStatus,
  RefundStatus,
} from "@/app/generated/prisma/client";

// 決済確定済みの予約をキャンセルし、キャンセルポリシーに応じた返金を行う。
// 返金が発生する場合、DB上の最終確定(status: cancelled)はWebhook(refund.created/updated)側で行う。
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/reservations/[id]/cancel">
) {
  const { id } = await ctx.params;

  let reason: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.reason === "string") {
      reason = body.reason.trim() || null;
    }
  } catch {
    // リクエストボディなし(空)は許容する
  }

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }

  if (reservation.status === ReservationStatus.cancelled) {
    return NextResponse.json(
      { error: "この予約は既にキャンセル済みです" },
      { status: 409 }
    );
  }

  // 未決済の仮押さえはキャンセル対象外(期限切れは既存のcron/expireStaleHoldsが処理する)
  if (
    reservation.status !== ReservationStatus.confirmed ||
    reservation.paymentStatus !== PaymentStatus.paid
  ) {
    return NextResponse.json(
      { error: "決済確定済みの予約のみキャンセルできます" },
      { status: 400 }
    );
  }

  const refundRate = calcRefundRate(reservation.date);
  const refundAmount = Math.round(CAR_UNIT_PRICE_JPY * refundRate);

  // 返金なしの直前キャンセルはStripe API呼び出し不要。DB更新のみで即完了させる
  if (refundAmount === 0) {
    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.cancelled,
        cancelledAt: new Date(),
        cancellationReason: reason,
        refundStatus: RefundStatus.none,
        refundAmount: 0,
      },
    });
    return NextResponse.json({
      reservationId: updated.id,
      refundAmount: 0,
      refundStatus: updated.refundStatus,
    });
  }

  if (!reservation.stripePaymentIntentId) {
    console.error("[cancel] reservation has no stripePaymentIntentId", id);
    return NextResponse.json(
      { error: "決済情報が見つからないため返金できません" },
      { status: 500 }
    );
  }

  try {
    await stripe.refunds.create(
      {
        payment_intent: reservation.stripePaymentIntentId,
        amount: refundAmount,
        reason: "requested_by_customer",
        metadata: { reservationId: id },
      },
      // 再試行での二重返金を防ぐ(同じキーなら同一Refundが返る)
      { idempotencyKey: `refund_${id}` }
    );
  } catch (err) {
    console.error("[cancel] stripe refund creation failed", id, err);
    return NextResponse.json(
      { error: "返金処理の開始に失敗しました" },
      { status: 502 }
    );
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      cancellationReason: reason,
      refundStatus: RefundStatus.pending,
      refundAmount,
    },
  });

  return NextResponse.json({
    reservationId: updated.id,
    refundAmount,
    refundStatus: updated.refundStatus,
  });
}
