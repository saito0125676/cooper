import { randomInt, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ReservationStatus, PaymentStatus } from "@/app/generated/prisma/client";
import type { CreateHoldInput } from "@/lib/reservations";

let counter = 0;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * テストごとに重複しない日付を作る(同じ日付を複数テストで使い回すと在庫が汚染されるため)。
 * テストDBは全テストファイルで共有されるため、単純な連番(ファイルごとに0から始まる)だと
 * ファイルをまたいで同じ日付が生成されてしまう。呼び出しごとに完全にランダムな
 * オフセットを使うことでファイル間の衝突を避ける。
 */
export function uniqueTestDate(): Date {
  // 西暦が5桁になるとtoISOString()が拡張フォーマット(例: "+012030-01-01")になり、
  // "YYYY-MM-DD"を前提にしたバリデーションが失敗するため、4桁の範囲に収める
  // (2030年 + 最大約2000日/365.25 ≈ 西暦7500年程度まで、で衝突確率は十分低い)
  const dayOffset = randomInt(1, 2_000_000);
  return new Date(Date.UTC(2030, 0, 1) + dayOffset * DAY_MS);
}

/**
 * Stripeのevent.id/Checkout Session ID/PaymentIntent IDのダミー値を作る。
 * stripeCheckoutSessionId/stripePaymentIntentIdはDB上でユニーク制約があり、
 * テストDBは全テストファイルで共有されるため、ファイルごとに独立した連番(1,2,3...)を
 * 使うとファイルをまたいで値が衝突してしまう。必ずこのヘルパー経由でランダムなIDを発行する。
 */
export function uniqueTestId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function dummyHoldInput(overrides: Partial<CreateHoldInput> = {}): CreateHoldInput {
  const n = ++counter;
  return {
    date: uniqueTestDate(),
    lastName: "テスト",
    firstName: `太郎${n}`,
    lastNameKana: "てすと",
    firstNameKana: "たろう",
    birthDate: new Date("1990-01-01T00:00:00.000Z"),
    postalCode: "1000001",
    prefecture: "東京都",
    city: "千代田区",
    town: "千代田",
    addressLine: "1-1",
    mobilePhone: "090-0000-0000",
    homePhone: null,
    email: `test${n}@example.com`,
    licenseNumber: `00000000000${n % 10}`,
    licenseIssuedDate: new Date("2015-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

/** 「すでに確定済みの予約がN件ある」状態を直接DBに作る(在庫を埋めるためのテスト用ヘルパー) */
export async function seedConfirmedReservations(date: Date, count: number) {
  for (let i = 0; i < count; i++) {
    const input = dummyHoldInput({ date });
    await prisma.reservation.create({
      data: {
        date: input.date,
        lastName: input.lastName,
        firstName: input.firstName,
        lastNameKana: input.lastNameKana,
        firstNameKana: input.firstNameKana,
        birthDate: input.birthDate,
        postalCode: input.postalCode,
        prefecture: input.prefecture,
        city: input.city,
        town: input.town,
        addressLine: input.addressLine,
        mobilePhone: input.mobilePhone,
        homePhone: input.homePhone,
        email: input.email,
        licenseNumber: input.licenseNumber,
        licenseIssuedDate: input.licenseIssuedDate,
        status: ReservationStatus.confirmed,
        paymentStatus: PaymentStatus.paid,
        holdStartedAt: new Date(),
      },
    });
  }
}
