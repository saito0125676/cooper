import { describe, expect, it, vi } from "vitest";
import { formatReservationDate, parseReservationDate } from "@/lib/reservations";

describe("parseReservationDate", () => {
  it("正しい形式の未来日付をパースできる", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    const date = parseReservationDate("2026-08-10");
    expect(formatReservationDate(date)).toBe("2026-08-10");
  });

  it("今日の日付は受け付ける", () => {
    vi.setSystemTime(new Date("2026-08-01T15:00:00.000Z"));
    const date = parseReservationDate("2026-08-01");
    expect(formatReservationDate(date)).toBe("2026-08-01");
  });

  it("フォーマットが不正な場合はRangeErrorを投げる", () => {
    expect(() => parseReservationDate("2026/08/10")).toThrow(RangeError);
    expect(() => parseReservationDate("not-a-date")).toThrow(RangeError);
  });

  it("実在しない日付はRangeErrorを投げる", () => {
    expect(() => parseReservationDate("2026-02-30")).toThrow(RangeError);
  });

  it("過去の日付はRangeErrorを投げる", () => {
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"));
    expect(() => parseReservationDate("2026-08-09")).toThrow(RangeError);
  });
});
