import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// デモの成功/キャンセル画面が、決済(Webhook)の反映状況を確認するための参照専用API
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/reservations/[id]">
) {
  const { id } = await ctx.params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      status: true,
      paymentStatus: true,
      lastName: true,
      firstName: true,
    },
  });

  if (!reservation) {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }

  return NextResponse.json(reservation);
}
