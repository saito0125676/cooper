import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createHold, SoldOutError, DEFAULT_DAILY_CAPACITY } from "@/lib/reservations";
import { dummyHoldInput, seedConfirmedReservations, uniqueTestDate } from "./testHelpers";

async function activeCountForDate(date: Date): Promise<number> {
  return prisma.reservation.count({
    where: {
      date,
      status: { in: ["pending_hold", "confirmed"] },
    },
  });
}

describe("二重予約防止(オーバーブッキング防止)", () => {
  it("在庫が0台の日に対して大量に同時リクエストを送っても、成功件数は容量(10台)ちょうどになる", async () => {
    const date = uniqueTestDate();
    const REQUEST_COUNT = 25; // 容量(10台)より明らかに多い件数を同時に撃ち込む

    const results = await Promise.allSettled(
      Array.from({ length: REQUEST_COUNT }, () => createHold(dummyHoldInput({ date })))
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const soldOut = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof SoldOutError
    );
    const others = results.filter(
      (r) => r.status === "rejected" && !(r.reason instanceof SoldOutError)
    );

    expect(others).toHaveLength(0);
    expect(succeeded).toHaveLength(DEFAULT_DAILY_CAPACITY);
    expect(soldOut).toHaveLength(REQUEST_COUNT - DEFAULT_DAILY_CAPACITY);

    // DBに実際に作られた行数もちょうど容量と一致することを直接確認する
    const activeCount = await activeCountForDate(date);
    expect(activeCount).toBe(DEFAULT_DAILY_CAPACITY);
  });

  it("残り1台の状態で2人が完全に同時に予約ボタンを押しても、成功するのは1人だけになる", async () => {
    const date = uniqueTestDate();
    // 容量10台のうち9台をあらかじめ確定済みにして「残り1台」の状態を作る
    await seedConfirmedReservations(date, DEFAULT_DAILY_CAPACITY - 1);
    expect(await activeCountForDate(date)).toBe(DEFAULT_DAILY_CAPACITY - 1);

    // 2人が同時にボタンを押すことを Promise.all で再現する
    const [resultA, resultB] = await Promise.allSettled([
      createHold(dummyHoldInput({ date })),
      createHold(dummyHoldInput({ date })),
    ]);

    const outcomes = [resultA, resultB];
    const succeeded = outcomes.filter((r) => r.status === "fulfilled");
    const soldOut = outcomes.filter(
      (r) => r.status === "rejected" && r.reason instanceof SoldOutError
    );

    expect(succeeded).toHaveLength(1);
    expect(soldOut).toHaveLength(1);

    // 最終的な在庫消費数が容量(10台)を超えていないことを確認する
    expect(await activeCountForDate(date)).toBe(DEFAULT_DAILY_CAPACITY);
  });

  it("異なる日付への同時リクエストは互いにブロックされず、それぞれ独立して成功する", async () => {
    const dateA = uniqueTestDate();
    const dateB = uniqueTestDate();

    const [resultA, resultB] = await Promise.allSettled([
      createHold(dummyHoldInput({ date: dateA })),
      createHold(dummyHoldInput({ date: dateB })),
    ]);

    expect(resultA.status).toBe("fulfilled");
    expect(resultB.status).toBe("fulfilled");
  });
});
