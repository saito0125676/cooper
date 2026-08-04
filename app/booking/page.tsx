"use client";

import { useCallback, useState } from "react";
import styles from "./page.module.css";
import ReservationCalendar from "../components/ReservationCalendar";
import CustomerInfoForm from "../components/CustomerInfoForm";
import type { CustomerInfoInput } from "@/lib/customerInfo";

type Step = "date" | "customer";

function todayStr(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export default function BookingPage() {
  const [step, setStep] = useState<Step>("date");
  const [date, setDate] = useState(todayStr());
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRemainingChange = useCallback((value: number | null) => {
    setRemaining(value);
  }, []);

  async function handleCustomerSubmit(info: CustomerInfoInput) {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, ...info }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "予約に失敗しました");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "予約に失敗しました");
      setSubmitting(false);
    }
  }

  const soldOut = remaining !== null && remaining <= 0;
  const canProceed = remaining !== null && !soldOut;

  if (step === "customer") {
    // 予約者情報入力は画像イメージに合わせて画面幅いっぱいの左揃えレイアウトにするため、
    // 大きな余白を持つ.main(カード中央寄せ)は使わず専用のレイアウトを使う
    return (
      <div className={styles.formPage}>
        <div className={styles.formHeader}>
          <h1>予約者情報の入力</h1>
          <p>
            レンタル日: <strong>{date}</strong>
          </p>
        </div>
        <CustomerInfoForm
          onBack={() => setStep("date")}
          onSubmit={handleCustomerSubmit}
          submitting={submitting}
          submitError={submitError}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>レンタカー予約デモ</h1>
        <p>1日単位のレンタル予約デモです。1日あたり10台までご予約いただけます。</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 400 }}>
          <ReservationCalendar
            selectedDate={date}
            onSelect={setDate}
            onRemainingChange={handleRemainingChange}
          />

          <p>
            選択中の日付: <strong>{date}</strong>
            {remaining !== null && (
              <>
                {" "}
                / 残り <strong>{remaining}</strong> 台
                {soldOut && <span style={{ color: "crimson" }}>(満車です)</span>}
              </>
            )}
          </p>

          <button type="button" disabled={!canProceed} onClick={() => setStep("customer")}>
            次へ(予約者情報の入力)
          </button>
        </div>
      </main>
    </div>
  );
}
