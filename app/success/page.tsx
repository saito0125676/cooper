import { Suspense } from "react";
import Link from "next/link";
import ReservationStatus from "./ReservationStatus";

export default function SuccessPage() {
  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1>お支払いありがとうございます</h1>
      <Suspense fallback={<p>読み込み中...</p>}>
        <ReservationStatus />
      </Suspense>
      <p>
        <Link href="/">トップへ戻る</Link>
      </p>
    </main>
  );
}
