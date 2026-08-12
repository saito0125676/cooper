"use client";

import { useCallback, useState } from "react";
import styles from "./BookingWidget.module.css";
import ReservationCalendar from "./ReservationCalendar";
import CustomerInfoForm from "./CustomerInfoForm";
import CarSelect from "./CarSelect";
import type { CustomerInfoInput } from "@/lib/customerInfo";
import { CARS, type CarOption } from "@/lib/cars";

type Step = "car" | "date" | "customer";

function todayStr(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export default function BookingWidget() {
  const [step, setStep] = useState<Step>("car");
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
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
  // 在庫取得に失敗した(remaining===null)場合はブロックしない。実際の空き確認は
  // POST /api/reservations 側でも行われるため、ここで弾くのはUXの都合のみ。
  const canProceed = !soldOut;

  const selectedCar: CarOption | undefined = CARS.find((c) => c.id === selectedCarId);

  function handleCarSelect(car: CarOption) {
    setSelectedCarId(car.id);
    setStep("date");
  }

  if (step === "car") {
    return (
      <div className={styles.widget}>
        <CarSelect selectedId={selectedCarId} onSelect={handleCarSelect} />
      </div>
    );
  }

  if (step === "customer") {
    return (
      <div className={styles.widget}>
        <div className={styles.formHeader}>
          <span className={styles.eyebrow}>RESERVATION · STEP 3</span>
          <h2 className={styles.widgetTitle}>予約者情報の入力</h2>
          <p className={styles.formSub}>
            {selectedCar && (
              <>
                車種: <strong>{selectedCar.name}</strong>
                <br />
              </>
            )}
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
    <div className={styles.widget}>
      <div className={styles.formHeader}>
        <span className={styles.eyebrow}>RESERVATION · STEP 2</span>
        {selectedCar && (
          <p className={styles.formSub}>
            車種: <strong>{selectedCar.name}</strong>{" "}
            <button type="button" className={styles.changeCarLink} onClick={() => setStep("car")}>
              車種を変更する
            </button>
          </p>
        )}
      </div>

      <ReservationCalendar
        selectedDate={date}
        onSelect={setDate}
        onRemainingChange={handleRemainingChange}
      />

      <p className={styles.remainingLine}>
        選択中の日付: <strong>{date}</strong>
        {remaining !== null && (
          <>
            {" "}
            / 残り <strong>{remaining}</strong> 台
            {soldOut && <span className={styles.soldOut}>（満車です）</span>}
          </>
        )}
      </p>

      <button
        type="button"
        className={styles.nextButton}
        disabled={!canProceed}
        onClick={() => setStep("customer")}
      >
        次へ（予約者情報の入力）
      </button>
    </div>
  );
}
