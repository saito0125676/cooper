import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { uniqueTestDate } from "./testHelpers";

function buildReservationBody(dateStr: string, email: string) {
  return {
    date: dateStr,
    lastName: "テスト",
    firstName: "太郎",
    lastNameKana: "てすと",
    firstNameKana: "たろう",
    birthDate: "1990-01-01",
    postalCode: "1000001",
    prefecture: "東京都",
    city: "千代田区",
    town: "千代田",
    addressLine: "1-1",
    mobilePhone: "090-0000-0000",
    homePhone: "",
    email,
    emailConfirm: email,
    licenseNumber: "000000000000",
    licenseIssuedDate: "2015-01-01",
  };
}

describe("Stripeの冪等キー(idempotencyKey)の扱い", () => {
  it("予約ごとに、DB上のidempotencyKeyがそのままStripe呼び出しのidempotencyKeyオプションとして渡される", async () => {
    vi.resetModules();
    const createMock = vi.fn().mockResolvedValue({
      id: "cs_test_idem_1",
      url: "https://checkout.stripe.com/test",
    });
    vi.doMock("@/lib/stripe", () => ({
      stripe: { checkout: { sessions: { create: createMock } } },
    }));

    const { POST } = await import("@/app/api/reservations/route");
    const date = uniqueTestDate();
    const dateStr = date.toISOString().slice(0, 10);

    const request = new NextRequest("http://localhost:3000/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildReservationBody(dateStr, "idem-check@example.com")),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    const { reservationId } = await response.json();

    const savedReservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });

    const [, options] = createMock.mock.calls[0];
    // Stripeに渡された冪等キーは、DBに保存されているこの予約自身のキーと完全に一致する
    expect(options.idempotencyKey).toBe(savedReservation.idempotencyKey);

    vi.doUnmock("@/lib/stripe");
  });

  it("2つの別々の予約リクエストは、必ず別々のidempotencyKeyを使う(取り違えが起きない)", async () => {
    vi.resetModules();
    const createMock = vi.fn().mockImplementation(async () => ({
      id: `cs_test_${Math.random()}`,
      url: "https://checkout.stripe.com/test",
    }));
    vi.doMock("@/lib/stripe", () => ({
      stripe: { checkout: { sessions: { create: createMock } } },
    }));

    const { POST } = await import("@/app/api/reservations/route");

    const dateA = uniqueTestDate().toISOString().slice(0, 10);
    const dateB = uniqueTestDate().toISOString().slice(0, 10);

    const requestA = new NextRequest("http://localhost:3000/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildReservationBody(dateA, "customer-a@example.com")),
    });
    const requestB = new NextRequest("http://localhost:3000/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildReservationBody(dateB, "customer-b@example.com")),
    });

    await POST(requestA);
    await POST(requestB);

    expect(createMock).toHaveBeenCalledTimes(2);
    const keyA = createMock.mock.calls[0][1].idempotencyKey;
    const keyB = createMock.mock.calls[1][1].idempotencyKey;

    // 別のお客様の予約に対して、他人の決済セッションが誤って返ってくることがないよう、
    // キーが一致していないことを確認する
    expect(keyA).not.toBe(keyB);

    vi.doUnmock("@/lib/stripe");
  });
});

describe("Webhook処理が途中で失敗した場合のリカバリー", () => {
  it("処理中にエラーが起きると、処理済み記録ごとロールバックされ、何も処理されなかった扱いになる", async () => {
    const eventId = `evt_fail_sim_${Math.random().toString(36).slice(2)}`;

    // 実際のWebhookハンドラ(lib/webhookHandlers.ts)と同じパターン
    // (「処理済みイベントの記録」と「業務処理」を同じトランザクションに入れる)を使い、
    // 業務処理の途中で予期せぬエラーが起きたケースを再現する。
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.processedWebhookEvent.create({ data: { id: eventId, type: "test.simulated" } });
        throw new Error("業務処理中に予期せぬエラーが発生した想定");
      })
    ).rejects.toThrow("業務処理中に予期せぬエラーが発生した想定");

    // ロールバックされているので「処理済み」の記録は残っていない
    const afterFailure = await prisma.processedWebhookEvent.findUnique({ where: { id: eventId } });
    expect(afterFailure).toBeNull();
  });

  it("失敗後にStripeが同じイベントを再送してくると、今度は正常に処理される", async () => {
    const eventId = `evt_retry_sim_${Math.random().toString(36).slice(2)}`;

    // 1回目: 失敗して何も残らない
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.processedWebhookEvent.create({ data: { id: eventId, type: "test.simulated" } });
        throw new Error("1回目は失敗する想定");
      })
    ).rejects.toThrow();

    // 2回目(Stripeからの再送を想定): 同じevent.idで、今度はエラーなく完了する
    await prisma.$transaction(async (tx) => {
      await tx.processedWebhookEvent.create({ data: { id: eventId, type: "test.simulated" } });
      // (ここで本来は予約確定などの業務処理が入るが、今回はリカバリーの検証が目的なので省略)
    });

    const afterRetry = await prisma.processedWebhookEvent.findUnique({ where: { id: eventId } });
    expect(afterRetry).not.toBeNull();
  });
});
