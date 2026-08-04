import { prisma } from "@/lib/prisma";
import { formatIsoDate, parseIsoDateStrict, todayUtc } from "@/lib/dates";
import {
  Prisma,
  ReservationStatus,
  PaymentStatus,
  type Reservation,
} from "@/app/generated/prisma/client";

export const HOLD_DURATION_MINUTES = 15;
export const DEFAULT_DAILY_CAPACITY = 10;

export class SoldOutError extends Error {
  constructor(dateStr: string) {
    super(`この日付(${dateStr})は満車です`);
    this.name = "SoldOutError";
  }
}

/** "YYYY-MM-DD" 形式かつ実在する未来日(今日を含む)かどうかを検証し、UTC 0時のDateに変換する */
export function parseReservationDate(dateStr: string): Date {
  const date = parseIsoDateStrict(dateStr);
  if (!date) {
    throw new RangeError("dateはYYYY-MM-DD形式の実在する日付で指定してください");
  }
  if (date.getTime() < todayUtc().getTime()) {
    throw new RangeError("過去の日付は予約できません");
  }
  return date;
}

export const formatReservationDate = formatIsoDate;

function activeHoldCutoff(): Date {
  return new Date(Date.now() - HOLD_DURATION_MINUTES * 60 * 1000);
}

/**
 * 「在庫を消費している」とみなす予約の絞り込み条件(日付以外の共通部分)。
 * - 決済確定済み(confirmed)
 * - 仮押さえ中(pending_hold)かつ、まだ15分のタイムアウトを超えていないもの
 * cronによるexpired化を待たずにここで期限切れを除外するので、
 * バッチが多少遅延しても在庫超過(二重予約)にはならない。
 */
function activeStatusOr(): Prisma.ReservationWhereInput["OR"] {
  return [
    { status: ReservationStatus.confirmed },
    {
      status: ReservationStatus.pending_hold,
      holdStartedAt: { gte: activeHoldCutoff() },
    },
  ];
}

function activeReservationWhere(date: Date): Prisma.ReservationWhereInput {
  return { date, OR: activeStatusOr() };
}

async function getDailyCapacity(
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const config = await client.inventoryConfig.findFirst({
    orderBy: { id: "asc" },
  });
  return config?.dailyCapacity ?? DEFAULT_DAILY_CAPACITY;
}

export async function getAvailability(date: Date) {
  const [capacity, reserved] = await Promise.all([
    getDailyCapacity(),
    prisma.reservation.count({ where: activeReservationWhere(date) }),
  ]);
  return {
    date: formatReservationDate(date),
    capacity,
    reserved,
    remaining: Math.max(capacity - reserved, 0),
  };
}

export interface MonthAvailabilityDay {
  date: string;
  remaining: number;
}

/** カレンダー表示用に、指定した年月の全日の残り台数をまとめて1回のクエリで取得する */
export async function getMonthAvailability(
  year: number,
  month: number
): Promise<{ capacity: number; days: MonthAvailabilityDay[] }> {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("monthは1〜12で指定してください");
  }
  if (!Number.isInteger(year) || year < 1970 || year > 2100) {
    throw new RangeError("yearが不正です");
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month - 1, daysInMonth));

  const [capacity, reservations] = await Promise.all([
    getDailyCapacity(),
    prisma.reservation.findMany({
      where: { date: { gte: firstDay, lte: lastDay }, OR: activeStatusOr() },
      select: { date: true },
    }),
  ]);

  const reservedCountByDate = new Map<string, number>();
  for (const r of reservations) {
    const key = formatReservationDate(r.date);
    reservedCountByDate.set(key, (reservedCountByDate.get(key) ?? 0) + 1);
  }

  const days: MonthAvailabilityDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = formatReservationDate(new Date(Date.UTC(year, month - 1, d)));
    const reserved = reservedCountByDate.get(key) ?? 0;
    days.push({ date: key, remaining: Math.max(capacity - reserved, 0) });
  }

  return { capacity, days };
}

export interface CreateHoldInput {
  date: Date;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  birthDate: Date;
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
  addressLine: string;
  mobilePhone: string;
  homePhone: string | null;
  email: string;
  licenseNumber: string;
  licenseIssuedDate: Date;
}

/**
 * 在庫チェック→仮押さえ作成を1つのDBトランザクションの中で行う。
 * 同じ日付に対する同時リクエストは pg_advisory_xact_lock で直列化されるため、
 * 「在庫確認」と「仮押さえ作成」の間に他のリクエストが割り込むことはない
 * (＝在庫数を超えて仮押さえが生成されることはない)。
 * ロックはこのトランザクションのCOMMIT/ROLLBACK時に自動的に解放される。
 */
export async function createHold(input: CreateHoldInput): Promise<Reservation> {
  return prisma.$transaction(async (tx) => {
    const dateKey = `reservation_date:${formatReservationDate(input.date)}`;
    // pg_advisory_xact_lock()はvoid型を返すため、$queryRaw(結果行を型変換しようとする)では
    // "Failed to deserialize column of type 'void'" エラーになる。
    // ロックの取得自体(副作用)だけが目的で戻り値は不要なので$executeRawを使う。
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dateKey}))`;

    const capacity = await getDailyCapacity(tx);
    const reserved = await tx.reservation.count({
      where: activeReservationWhere(input.date),
    });

    if (reserved >= capacity) {
      throw new SoldOutError(formatReservationDate(input.date));
    }

    return tx.reservation.create({
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
        status: ReservationStatus.pending_hold,
        paymentStatus: PaymentStatus.unpaid,
        holdStartedAt: new Date(),
      },
    });
  });
}

export async function attachCheckoutSession(
  reservationId: string,
  sessionId: string
): Promise<void> {
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { stripeCheckoutSessionId: sessionId },
  });
}

/** 予約作成後にStripe側の処理が失敗した場合、仮押さえを解放するためのロールバック */
export async function releaseHold(reservationId: string): Promise<void> {
  await prisma.reservation.updateMany({
    where: { id: reservationId, status: ReservationStatus.pending_hold },
    data: { status: ReservationStatus.cancelled },
  });
}

export interface ExpiredHold {
  id: string;
  stripeCheckoutSessionId: string | null;
}

/** 15分経過して未決済のままの仮押さえを一括でexpiredにする(Cron用) */
export async function expireStaleHolds(): Promise<ExpiredHold[]> {
  const stale = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.pending_hold,
      holdStartedAt: { lt: activeHoldCutoff() },
    },
    select: { id: true },
  });

  if (stale.length === 0) return [];

  const ids = stale.map((r) => r.id);

  // findManyで対象を洗い出した直後にWebhookが決済確定(pending_hold→confirmed)させる
  // 可能性があるため、更新時にも status: pending_hold を再チェックする。
  // これが無いと「支払い済みなのに期限切れで上書きされる」事故が起こり得る。
  await prisma.reservation.updateMany({
    where: { id: { in: ids }, status: ReservationStatus.pending_hold },
    data: { status: ReservationStatus.expired },
  });

  // 実際にexpiredへ更新できた行だけを返す
  // (webhookが先に確定させていた行はここでは対象外になる)
  return prisma.reservation.findMany({
    where: { id: { in: ids }, status: ReservationStatus.expired },
    select: { id: true, stripeCheckoutSessionId: true },
  });
}
