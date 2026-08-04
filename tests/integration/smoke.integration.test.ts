import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

describe("PGliteテストDB疎通確認", () => {
  it("InventoryConfigのseedデータが読める", async () => {
    const config = await prisma.inventoryConfig.findFirst();
    expect(config?.dailyCapacity).toBe(10);
  });

  it("Reservationの作成・取得ができる(実テーブル経由)", async () => {
    const created = await prisma.reservation.create({
      data: {
        date: new Date("2027-01-01T00:00:00.000Z"),
        lastName: "テスト",
        firstName: "太郎",
        lastNameKana: "てすと",
        firstNameKana: "たろう",
        birthDate: new Date("1990-01-01T00:00:00.000Z"),
        postalCode: "1000001",
        prefecture: "東京都",
        city: "千代田区",
        town: "千代田",
        addressLine: "1-1",
        mobilePhone: "090-0000-0000",
        email: "smoke@example.com",
        licenseNumber: "000000000000",
        licenseIssuedDate: new Date("2015-01-01T00:00:00.000Z"),
        holdStartedAt: new Date(),
      },
    });
    const found = await prisma.reservation.findUnique({ where: { id: created.id } });
    expect(found?.lastName).toBe("テスト");
  });
});
