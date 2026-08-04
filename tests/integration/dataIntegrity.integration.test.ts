import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createHold, SoldOutError, DEFAULT_DAILY_CAPACITY } from "@/lib/reservations";
import { confirmReservationFromSession } from "@/lib/webhookHandlers";
import { dummyHoldInput, seedConfirmedReservations, uniqueTestDate, uniqueTestId } from "./testHelpers";
import type Stripe from "stripe";

function fakeCheckoutSession(reservationId: string): Stripe.Checkout.Session {
  return {
    id: uniqueTestId("cs_test"),
    metadata: { reservationId },
    client_reference_id: reservationId,
    payment_status: "paid",
    payment_intent: uniqueTestId("pi_test"),
  } as unknown as Stripe.Checkout.Session;
}

describe("データ不整合の防止", () => {
  it("仮押さえ直後は status=pending_hold かつ paymentStatus=unpaid で、それ以外の組み合わせにならない", async () => {
    const date = uniqueTestDate();
    const hold = await createHold(dummyHoldInput({ date }));
    expect(hold.status).toBe("pending_hold");
    expect(hold.paymentStatus).toBe("unpaid");
  });

  it("決済確定後は status=confirmed かつ paymentStatus=paid が必ずセットで揃う", async () => {
    const date = uniqueTestDate();
    const hold = await createHold(dummyHoldInput({ date }));
    await prisma.$transaction((tx) => confirmReservationFromSession(tx, fakeCheckoutSession(hold.id)));

    const updated = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    expect(updated.status).toBe("confirmed");
    expect(updated.paymentStatus).toBe("paid");
  });

  it("DB全体を見ても「confirmedなのにpaymentStatusがunpaid/failed」という行は存在しない", async () => {
    // これまでのテストで作られたデータも含めて、実際にDB全体をスキャンして矛盾がないか確認する
    const inconsistent = await prisma.reservation.findMany({
      where: {
        status: "confirmed",
        paymentStatus: { in: ["unpaid", "failed"] },
      },
    });
    expect(inconsistent).toHaveLength(0);
  });

  it("満車で予約が失敗した場合、中途半端な行が1件も作られない(在庫チェックと作成が同一トランザクション)", async () => {
    const date = uniqueTestDate();
    await seedConfirmedReservations(date, DEFAULT_DAILY_CAPACITY);

    const before = await prisma.reservation.count({ where: { date } });
    expect(before).toBe(DEFAULT_DAILY_CAPACITY);

    await expect(createHold(dummyHoldInput({ date }))).rejects.toThrow(SoldOutError);

    // 失敗した分の「仮の行」が残っていないこと(件数が増えていないこと)を確認する
    const after = await prisma.reservation.count({ where: { date } });
    expect(after).toBe(DEFAULT_DAILY_CAPACITY);
  });

  it("存在しない予約IDへのWebhook確定処理は、エラーにせず安全に無視する(存在しないデータへの不整合な書き込みを防ぐ)", async () => {
    const fakeSession = fakeCheckoutSession("does-not-exist-id");
    // 例外を投げずに正常終了すること(存在しないレコードへのupdateでクラッシュしない)
    await expect(
      prisma.$transaction((tx) => confirmReservationFromSession(tx, fakeSession))
    ).resolves.not.toThrow();
  });
});
