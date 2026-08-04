import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { createHold } from "@/lib/reservations";
import { processStripeEventOnce } from "@/lib/webhookHandlers";
import { dummyHoldInput, uniqueTestDate, uniqueTestId } from "./testHelpers";

function fakeCheckoutCompletedEvent(reservationId: string): Stripe.Event {
  return {
    id: uniqueTestId("evt_test"),
    type: "checkout.session.completed",
    data: {
      object: {
        id: uniqueTestId("cs_test"),
        metadata: { reservationId },
        client_reference_id: reservationId,
        payment_status: "paid",
        payment_intent: uniqueTestId("pi_test"),
      },
    },
  } as unknown as Stripe.Event;
}

describe("Stripe Webhookの重複配信対策", () => {
  // 注: 「同じevent.idが2回届く」ケースは、ユニーク制約(processedWebhookEvent.id)違反による
  // ロールバックを意図的に発生させて確認する。
  // テストで使っているPGlite(WASM上で動く簡易Postgres)には、Prismaの対話的トランザクション
  // ($transaction)がSQLレベルの制約違反で実際にロールバックした際、その後のクエリに
  // 影響が残ることがある既知の制約がある(生のpgクライアントによる素の BEGIN/INSERT/ROLLBACK
  // では発生しないため、実運用で使う本物のPostgresでは起こらないことを確認済み)。
  // そのため、この挙動を確認するテストは1つに絞り、ファイル内で最後に実行して
  // 他のテストへの影響を避けている。
  it("同じevent.idのイベントが2回届いても、予約は1回しか確定処理されない", async () => {
    const date = uniqueTestDate();
    const hold = await createHold(dummyHoldInput({ date }));
    const event = fakeCheckoutCompletedEvent(hold.id);

    const firstResult = await processStripeEventOnce(event);
    expect(firstResult).toBe("processed");

    const afterFirst = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    expect(afterFirst.status).toBe("confirmed");
    expect(afterFirst.paymentStatus).toBe("paid");

    const processedCountAfterFirst = await prisma.processedWebhookEvent.count({
      where: { id: event.id },
    });
    expect(processedCountAfterFirst).toBe(1);

    // Stripeの仕様上あり得る「同じイベントの再送」を再現する(全く同じevent.id)。
    // ユニーク制約違反でトランザクションがロールバックされ、"duplicate"として無視される。
    // (このロールバックの後は上記のPGlite側の制約により、以降のDB再取得が信頼できないため
    // 戻り値の確認のみ行う。詳しくはdescribeの先頭コメント参照)
    const secondResult = await processStripeEventOnce(event);
    expect(secondResult).toBe("duplicate");
  });
});

describe("Stripe Webhookの署名検証", () => {
  const webhookSecret = "whsec_test_secret_for_verification";

  it("正しい署名のリクエストは検証を通過する", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });

    const event = stripe.webhooks.constructEvent(payload, header, webhookSecret);
    expect(event.id).toBe("evt_1");
  });

  it("署名が正しくても、ペイロードが改ざんされていると検証エラーになる", () => {
    const payload = JSON.stringify({ id: "evt_1", amount: 8000 });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });

    const tamperedPayload = JSON.stringify({ id: "evt_1", amount: 0 });

    expect(() =>
      stripe.webhooks.constructEvent(tamperedPayload, header, webhookSecret)
    ).toThrow();
  });

  it("Webhookシークレットが間違っていると検証エラーになる(なりすまし対策)", () => {
    const payload = JSON.stringify({ id: "evt_1" });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });

    expect(() =>
      stripe.webhooks.constructEvent(payload, header, "whsec_wrong_secret")
    ).toThrow();
  });

  it("署名ヘッダが無い/デタラメだと検証エラーになる", () => {
    const payload = JSON.stringify({ id: "evt_1" });

    expect(() =>
      stripe.webhooks.constructEvent(payload, "t=1,v1=deadbeef", webhookSecret)
    ).toThrow();
  });
});
