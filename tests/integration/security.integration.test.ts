import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHold } from "@/lib/reservations";
import { dummyHoldInput, uniqueTestDate } from "./testHelpers";

describe("入力値の安全性(SQLインジェクション/XSS)", () => {
  it("SQLインジェクションを試みる文字列を入力しても、ただの文字列として安全に保存される", async () => {
    const date = uniqueTestDate();
    const maliciousName = `'); DROP TABLE "Reservation"; --`;

    const hold = await createHold(
      dummyHoldInput({ date, lastName: maliciousName })
    );

    const saved = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    // 文字列としてそのまま保存されているだけで、SQLとして実行されていないこと
    expect(saved.lastName).toBe(maliciousName);

    // テーブル自体が破壊されていないこと(生き残って通常通りクエリできること)
    const stillWorks = await prisma.reservation.count();
    expect(stillWorks).toBeGreaterThan(0);
  });

  it("<script>タグを含む文字列を入力しても、そのまま文字列として保存されエスケープの必要がある形で残る", async () => {
    const date = uniqueTestDate();
    const xssPayload = `<script>alert('xss')</script>`;

    const hold = await createHold(
      dummyHoldInput({ date, addressLine: xssPayload })
    );

    const saved = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    // DB保存時点では無害化(サニタイズ)されていないことを確認する。
    // これは仕様として問題ない: 画面表示側(Reactの標準JSXレンダリング)が
    // 自動的にHTMLエスケープするため、dangerouslySetInnerHTML等を使っていない限り
    // このデータが実行可能なHTMLとして描画されることはない(コードレビューで
    // dangerouslySetInnerHTMLの使用箇所が無いことも確認済み)。
    expect(saved.addressLine).toBe(xssPayload);
  });
});

describe("決済金額の改ざん耐性", () => {
  it("クライアントが不正な金額を送っても、Stripe Checkoutには常にサーバー側の固定金額が使われる", async () => {
    vi.resetModules();
    const createMock = vi.fn().mockResolvedValue({
      id: "cs_test_price_check",
      url: "https://checkout.stripe.com/test",
    });
    vi.doMock("@/lib/stripe", () => ({
      stripe: { checkout: { sessions: { create: createMock } } },
    }));

    const { POST } = await import("@/app/api/reservations/route");
    const date = uniqueTestDate();
    const dateStr = date.toISOString().slice(0, 10);

    const maliciousBody = {
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
      email: "price-check@example.com",
      emailConfirm: "price-check@example.com",
      licenseNumber: "000000000000",
      licenseIssuedDate: "2015-01-01",
      // クライアントから金額を改ざんしようとする不正なフィールド(本来存在しない項目)
      amount: 1,
      unit_amount: 1,
      price: 1,
    };

    const request = new NextRequest("http://localhost:3000/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(maliciousBody),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    expect(createMock).toHaveBeenCalledTimes(1);
    const [sessionArgs] = createMock.mock.calls[0];
    const unitAmount = sessionArgs.line_items[0].price_data.unit_amount;

    // クライアントが送った amount/unit_amount/price は一切使われず、
    // サーバー側の固定金額(8000円)がそのまま使われている
    expect(unitAmount).toBe(8000);

    vi.doUnmock("@/lib/stripe");
  });
});
