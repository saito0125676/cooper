// DBやStripeに依存しない純粋な返金ポリシー計算。
// lib/dates.tsと同様、クライアントからも安全にimportできる。

import { todayUtc } from "@/lib/dates";

/** レンタル日までの残り日数(UTC日付ベース、切り捨て)を計算する */
function daysUntil(reservationDate: Date, now: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const nowDateOnly = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return Math.floor((reservationDate.getTime() - nowDateOnly) / MS_PER_DAY);
}

/**
 * レンタル日までの残り日数に応じた返金率を返す。
 * 7日以上前: 全額返金 / 3〜6日前: 半額返金 / 2日前〜当日: 返金なし
 * 日数計算はサーバー側の現在時刻(todayUtc)で行い、クライアントの入力は信用しない。
 */
export function calcRefundRate(reservationDate: Date, now: Date = todayUtc()): number {
  const remaining = daysUntil(reservationDate, now);
  if (remaining >= 7) return 1.0;
  if (remaining >= 3) return 0.5;
  return 0;
}
