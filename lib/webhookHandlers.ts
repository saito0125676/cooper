import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  ReservationStatus,
  PaymentStatus,
} from "@/app/generated/prisma/client";

export type ProcessEventResult = "processed" | "duplicate";

/**
 * イベントの重複配信対策:
 * 「処理済みイベントIDの記録」と「予約ステータスの更新」を同じDBトランザクションに入れる。
 * event.idを主キーにしたINSERTがユニーク制約違反になった場合は、
 * 同じイベントを既に処理済みという意味なので何もせずduplicate扱いにする。
 * ハンドラ内で例外が起きた場合はトランザクション全体がロールバックされ、
 * 「処理済み」の記録も残らないので、Stripeの再送で正しくリトライできる。
 */
export async function processStripeEventOnce(
  event: Stripe.Event
): Promise<ProcessEventResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.processedWebhookEvent.create({
        data: { id: event.id, type: event.type },
      });
      await handleStripeEvent(tx, event);
    });
    return "processed";
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return "duplicate";
    }
    throw err;
  }
}

export async function handleStripeEvent(
  tx: Prisma.TransactionClient,
  event: Stripe.Event
) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      await confirmReservationFromSession(
        tx,
        event.data.object as Stripe.Checkout.Session
      );
      return;
    }
    case "checkout.session.expired": {
      await expireReservationFromSession(
        tx,
        event.data.object as Stripe.Checkout.Session
      );
      return;
    }
    case "checkout.session.async_payment_failed": {
      const reservationId = reservationIdFromSession(
        event.data.object as Stripe.Checkout.Session
      );
      await markPaymentFailed(tx, reservationId);
      return;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await markPaymentFailed(tx, intent.metadata?.reservationId);
      return;
    }
    default:
      // このデモで扱わないイベント種別は無視する
      return;
  }
}

export function reservationIdFromSession(
  session: Stripe.Checkout.Session
): string | undefined {
  return session.metadata?.reservationId ?? session.client_reference_id ?? undefined;
}

export function paymentIntentIdFromSession(
  session: Stripe.Checkout.Session
): string | undefined {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
}

export async function confirmReservationFromSession(
  tx: Prisma.TransactionClient,
  session: Stripe.Checkout.Session
) {
  const reservationId = reservationIdFromSession(session);
  if (!reservationId) {
    console.error("[webhook] session has no reservationId", session.id);
    return;
  }

  // 銀行振込・コンビニ払いなど非同期決済手段では、checkout.session.completed が
  // payment_status="unpaid" のまま先に届き、入金確定は後続の
  // checkout.session.async_payment_succeeded を待つ必要がある。
  // ここでpayment_statusを確認せずに確定させると、未入金のまま予約確定してしまう。
  if (session.payment_status !== "paid") {
    console.warn(
      `[webhook] session ${session.id} payment_status=${session.payment_status} のため確定を保留`
    );
    return;
  }

  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
  });
  if (!reservation) {
    console.error("[webhook] reservation not found", reservationId);
    return;
  }

  const paymentIntentId = paymentIntentIdFromSession(session);

  if (reservation.status !== ReservationStatus.pending_hold) {
    // 仮押さえのタイムアウト(15分)はStripe Checkout自体の最短有効期限(30分)より短いため、
    // ごく稀に「こちらで仮押さえを失効させた直後にStripe側の決済が完了する」ケースがあり得る。
    // その場合は在庫を横取りしてconfirmedにはせず、入金だけ記録して要確認の状態にする
    // (実運用では返金 or 別枠での手配を行う)。
    await tx.reservation.update({
      where: { id: reservationId },
      data: { paymentStatus: PaymentStatus.paid, stripePaymentIntentId: paymentIntentId },
    });
    console.warn(
      `[webhook] reservation ${reservationId} status=${reservation.status} だが決済完了 - 要確認`
    );
    return;
  }

  await tx.reservation.update({
    where: { id: reservationId },
    data: {
      status: ReservationStatus.confirmed,
      paymentStatus: PaymentStatus.paid,
      stripePaymentIntentId: paymentIntentId,
    },
  });
}

export async function expireReservationFromSession(
  tx: Prisma.TransactionClient,
  session: Stripe.Checkout.Session
) {
  const reservationId = reservationIdFromSession(session);
  if (!reservationId) return;

  // pending_holdのままのものだけexpiredにする(既にconfirmed/expired等なら触らない)
  await tx.reservation.updateMany({
    where: { id: reservationId, status: ReservationStatus.pending_hold },
    data: { status: ReservationStatus.expired },
  });
}

export async function markPaymentFailed(
  tx: Prisma.TransactionClient,
  reservationId: string | undefined
) {
  if (!reservationId) return;
  await tx.reservation.updateMany({
    where: { id: reservationId },
    data: { paymentStatus: PaymentStatus.failed },
  });
}
