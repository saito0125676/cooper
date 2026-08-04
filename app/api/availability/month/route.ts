import { NextRequest, NextResponse } from "next/server";
import { getMonthAvailability } from "@/lib/reservations";

// カレンダーUI用に、指定した年月の全日の残り台数をまとめて返す
export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get("year"));
  const month = Number(request.nextUrl.searchParams.get("month"));

  try {
    const { capacity, days } = await getMonthAvailability(year, month);
    return NextResponse.json({ year, month, capacity, days });
  } catch (err) {
    if (err instanceof RangeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[availability/month] failed", err);
    return NextResponse.json(
      { error: "月間の在庫状況の取得に失敗しました" },
      { status: 500 }
    );
  }
}
