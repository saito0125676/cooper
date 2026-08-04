import Link from "next/link";

export default function CancelPage() {
  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1>決済がキャンセルされました</h1>
      <p>
        予約の仮押さえは15分間保持されます。もう一度お手続きいただくか、
        時間をおいて再度ご予約ください。
      </p>
      <p>
        <Link href="/">トップへ戻る</Link>
      </p>
    </main>
  );
}
