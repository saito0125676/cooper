import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { expireStaleHolds } from "@/lib/reservations";

/**
 * 15分以内に決済されなかった仮押さえ(pending_hold)を一括でexpiredにするバッチ。
 * 外部のCronサービス(Vercel Cron / cron-job.org / Windowsタスクスケジューラ等)から
 * 一定間隔(例: 1分毎)でこのエンドポイントを叩く想定。
 *
 * 実際の在庫計算(lib/reservations.ts の activeReservationWhere)は
 * holdStartedAtが15分より新しいかどうかで判定しているため、
 * このバッチの実行が多少遅延しても二重予約には繋がらない。
 * このバッチの役割は「あくまでデータを綺麗な状態(expired)に揃える」ことと、
 * 「Stripe Checkout Sessionを早めに閉じて決済不能にする」こと。
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }

  const expired = await expireStaleHolds();

  // Stripe側のCheckout Sessionもベストエフォートで早期失効させる。
  // (Stripe自身の最短有効期限は30分のため、こちらの15分ルールとの間に
  //  隙間ができるのを防ぐ目的。失敗しても致命的ではないので握りつぶす)
  await Promise.allSettled(
    expired
      .filter((r) => r.stripeCheckoutSessionId)
      .map((r) => stripe.checkout.sessions.expire(r.stripeCheckoutSessionId!))
  );

  return NextResponse.json({ expiredCount: expired.length });
}
