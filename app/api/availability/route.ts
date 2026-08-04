import { NextRequest, NextResponse } from "next/server";
import { getAvailability, parseReservationDate } from "@/lib/reservations";

export async function GET(request: NextRequest) {
  const dateStr = request.nextUrl.searchParams.get("date");
  if (!dateStr) {
    return NextResponse.json(
      { error: "dateクエリパラメータが必要です(例: ?date=2026-08-10)" },
      { status: 400 }
    );
  }

  try {
    const date = parseReservationDate(dateStr);
    const availability = await getAvailability(date);
    return NextResponse.json(availability);
  } catch (err) {
    if (err instanceof RangeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[availability] failed", err);
    return NextResponse.json(
      { error: "在庫状況の取得に失敗しました" },
      { status: 500 }
    );
  }
}
