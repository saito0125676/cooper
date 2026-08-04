// DBやStripeに依存しない純粋な日付ユーティリティ。
// クライアントコンポーネント(ブラウザ)からも安全にimportできるよう、
// prisma/stripeなどサーバー専用のモジュールには一切依存しない。

/** "YYYY-MM-DD" 形式かつ実在する日付かどうかを検証してUTC 0時のDateを返す(不正な場合はnull) */
export function parseIsoDateStrict(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  // "2026-02-30" のような実在しない日付はDate.UTCが自動的に繰り上げてしまう(3/2等)ので、
  // 逆算して元の年月日と一致するかを検証する
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
