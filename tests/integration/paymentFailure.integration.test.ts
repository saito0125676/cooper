import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createHold } from "@/lib/reservations";
import { markPaymentFailed } from "@/lib/webhookHandlers";
import { dummyHoldInput, uniqueTestDate } from "./testHelpers";

describe("決済失敗・離脱時の挙動", () => {
  it("カード拒否等でpayment_intent.payment_failedが届くと、予約は残したままpaymentStatusだけfailedになる", async () => {
    const date = uniqueTestDate();
    const hold = await createHold(dummyHoldInput({ date }));

    await prisma.$transaction((tx) => markPaymentFailed(tx, hold.id));

    const updated = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    // 仮押さえ(在庫)はまだ生きたまま = 15分以内なら別カードで再挑戦できる
    expect(updated.status).toBe("pending_hold");
    expect(updated.paymentStatus).toBe("failed");
  });

  it("決済失敗しても在庫が二重に減ることはない(在庫計算はpending_hold/confirmedの件数だけを見る)", async () => {
    const date = uniqueTestDate();
    const hold = await createHold(dummyHoldInput({ date }));
    await prisma.$transaction((tx) => markPaymentFailed(tx, hold.id));

    const activeCount = await prisma.reservation.count({
      where: { date, status: { in: ["pending_hold", "confirmed"] } },
    });
    // 決済失敗しても行が増えたり減ったりしない(1件のまま)
    expect(activeCount).toBe(1);
  });

  it("お客様が決済画面から離脱してブラウザを閉じた場合も、15分経過すれば通常のタイムアウト処理で在庫が解放される", async () => {
    // 離脱時にStripeから明示的なイベントが飛んでこないケースがある(checkout.session.expiredが
    // 発生するのは通常Stripe側の最短30分後)。そのため当システムは「決済完了イベントが来ない限り
    // 何もしない」設計になっており、15分の仮押さえタイムアウト(expireStaleHolds)だけで
    // 離脱ケースも含めて確実に在庫を解放できる。
    const date = uniqueTestDate();
    const hold = await createHold(dummyHoldInput({ date }));
    await prisma.reservation.update({
      where: { id: hold.id },
      data: { holdStartedAt: new Date(Date.now() - 16 * 60 * 1000) },
    });

    const { expireStaleHolds } = await import("@/lib/reservations");
    const expired = await expireStaleHolds();
    expect(expired.map((r) => r.id)).toContain(hold.id);
  });
});
