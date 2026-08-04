import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createHold, expireStaleHolds } from "@/lib/reservations";
import { confirmReservationFromSession } from "@/lib/webhookHandlers";
import { dummyHoldInput, uniqueTestDate, uniqueTestId } from "./testHelpers";

/** holdStartedAtを15分より過去に書き換えて「タイムアウト済みの仮押さえ」を再現する */
async function backdateHold(reservationId: string, minutesAgo: number) {
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { holdStartedAt: new Date(Date.now() - minutesAgo * 60 * 1000) },
  });
}

function fakeCheckoutSession(reservationId: string): Stripe.Checkout.Session {
  return {
    id: uniqueTestId("cs_test"),
    metadata: { reservationId },
    client_reference_id: reservationId,
    payment_status: "paid",
    payment_intent: uniqueTestId("pi_test"),
  } as unknown as Stripe.Checkout.Session;
}

describe("仮押さえのタイムアウト処理", () => {
  it("15分経過したpending_holdはexpiredになり、在庫が戻る", async () => {
    const date = uniqueTestDate();
    const hold = await createHold(dummyHoldInput({ date }));
    await backdateHold(hold.id, 16);

    const expired = await expireStaleHolds();
    expect(expired.map((r) => r.id)).toContain(hold.id);

    const updated = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    expect(updated.status).toBe("expired");

    // 在庫が戻っているので、同じ日付に新しい仮押さえが取れる
    const next = await createHold(dummyHoldInput({ date }));
    expect(next.id).toBeDefined();
  });

  it("15分以内のpending_holdはタイムアウト処理の対象にならない", async () => {
    const date = uniqueTestDate();
    const hold = await createHold(dummyHoldInput({ date }));
    // backdateしない = 作りたて

    const expired = await expireStaleHolds();
    expect(expired.map((r) => r.id)).not.toContain(hold.id);

    const stillHeld = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    expect(stillHeld.status).toBe("pending_hold");
  });

  it("タイムアウト処理を連続で2回実行しても、2回目はエラーなく何もしない(冪等)", async () => {
    const date = uniqueTestDate();
    const hold = await createHold(dummyHoldInput({ date }));
    await backdateHold(hold.id, 20);

    const firstRun = await expireStaleHolds();
    expect(firstRun.map((r) => r.id)).toContain(hold.id);

    // 1回目の実行が何らかの理由で失敗しても、2回目の実行時にDBの最新状態から
    // 再判定するので正しくリカバリーできる、という設計を確認する
    const secondRun = await expireStaleHolds();
    expect(secondRun).toHaveLength(0);

    const finalState = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    expect(finalState.status).toBe("expired");
  });

  it("Webhookでの決済確定がタイムアウト処理より先に完了した場合、後からcronが実行されても確定を上書きしない", async () => {
    const date = uniqueTestDate();
    const hold = await createHold(dummyHoldInput({ date }));
    await backdateHold(hold.id, 16); // 15分の期限は過ぎているが、決済はぎりぎり間に合ったケース

    // Webhookが先に到着し、決済確定処理が完了する
    await prisma.$transaction((tx) => confirmReservationFromSession(tx, fakeCheckoutSession(hold.id)));

    const afterWebhook = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    expect(afterWebhook.status).toBe("confirmed");
    expect(afterWebhook.paymentStatus).toBe("paid");

    // その後にcronのタイムアウト処理が実行される
    const expired = await expireStaleHolds();
    expect(expired.map((r) => r.id)).not.toContain(hold.id);

    // 支払い済みの予約が期限切れで上書きされていないことを確認する(修正前は起きていたバグ)
    const afterCron = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    expect(afterCron.status).toBe("confirmed");
    expect(afterCron.paymentStatus).toBe("paid");
  });

  it("タイムアウト処理が先に走った後にWebhookの決済確定が届いても、在庫を横取りせず支払い記録だけ残す", async () => {
    const date = uniqueTestDate();
    const hold = await createHold(dummyHoldInput({ date }));
    await backdateHold(hold.id, 16);

    // cronが先に実行され、仮押さえが失効する
    const expired = await expireStaleHolds();
    expect(expired.map((r) => r.id)).toContain(hold.id);

    // 少し遅れてWebhookの決済確定が届く
    await prisma.$transaction((tx) => confirmReservationFromSession(tx, fakeCheckoutSession(hold.id)));

    const final = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    // 在庫を横取りしてconfirmedにはしない(既に他の人に渡っている可能性があるため)が、
    // 入金があった事実は記録に残す(要確認フラグ代わり)
    expect(final.status).toBe("expired");
    expect(final.paymentStatus).toBe("paid");
  });
});
