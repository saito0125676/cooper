"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Reservation {
  id: string;
  date: string;
  status: string;
  paymentStatus: string;
  lastName: string;
  firstName: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending_hold: "決済の反映待ちです(数秒お待ちください)",
  confirmed: "予約が確定しました",
  cancelled: "予約はキャンセルされました",
  expired: "仮押さえの期限が切れました",
};

export default function ReservationStatus() {
  const searchParams = useSearchParams();
  const reservationId = searchParams.get("reservation_id");
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reservationId) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/reservations/${reservationId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "予約情報の取得に失敗しました");
          return;
        }
        setReservation(data);
      } catch {
        if (!cancelled) setError("予約情報の取得に失敗しました");
      }
    }

    poll();
    // Webhookの反映を待つため数秒おきに再確認する(決済確定までタイムラグがあるため)
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [reservationId]);

  if (!reservationId) {
    return <p>予約IDが指定されていません。</p>;
  }

  if (error) {
    return <p style={{ color: "crimson" }}>{error}</p>;
  }

  if (!reservation) {
    return <p>予約情報を確認しています...</p>;
  }

  return (
    <div>
      <p>{STATUS_LABEL[reservation.status] ?? reservation.status}</p>
      <ul>
        <li>予約日: {reservation.date.slice(0, 10)}</li>
        <li>
          お名前: {reservation.lastName} {reservation.firstName}
        </li>
        <li>予約ステータス: {reservation.status}</li>
        <li>決済ステータス: {reservation.paymentStatus}</li>
      </ul>
    </div>
  );
}
