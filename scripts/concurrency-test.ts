/**
 * 二重予約防止(在庫超過防止)の結合テスト。
 *
 * 起動中のNext.jsサーバー(+ 実際のPostgres)に対して、同じ日付宛てに
 * 「残り台数より多い」件数の予約リクエストを完全に同時発火し、
 * 成功件数が残り台数ちょうどになる(＝在庫を超えて仮押さえが作られない)ことを検証する。
 *
 * 実行方法:
 *   1. docker compose up -d  (ローカルPostgres起動)
 *   2. npx prisma migrate dev --name init && npx prisma db seed
 *   3. npm run dev  (別ターミナルで起動したままにする)
 *   4. npx tsx scripts/concurrency-test.ts [対象日 YYYY-MM-DD] [同時リクエスト数]
 */

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

function defaultTestDate(): string {
  // 過去日付エラーを避けるため、確実に未来になる30日後を使う
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
}

async function getRemaining(date: string): Promise<number> {
  const res = await fetch(`${baseUrl}/api/availability?date=${date}`);
  if (!res.ok) {
    throw new Error(`availability取得に失敗: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.remaining as number;
}

function dummyCustomerInfo(index: number) {
  const email = `test${index}@example.com`;
  return {
    lastName: "テスト",
    firstName: `太郎${index}`,
    lastNameKana: "てすと",
    firstNameKana: "たろう",
    birthDate: "1990-01-01",
    postalCode: "1000001",
    prefecture: "東京都",
    city: "千代田区",
    town: "千代田",
    addressLine: "1-1",
    mobilePhone: "090-0000-0000",
    homePhone: "",
    email,
    emailConfirm: email,
    licenseNumber: `12345678901${index % 10}`,
    licenseIssuedDate: "2015-04-01",
  };
}

async function attemptReservation(date: string, index: number) {
  const res = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, ...dummyCustomerInfo(index) }),
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  const date = process.argv[2] ?? defaultTestDate();
  const remainingBefore = await getRemaining(date);

  // 残り台数より明らかに多い件数を同時に撃ち込む
  const requestCount = Number(process.argv[3] ?? remainingBefore + 10);

  console.log(`[concurrency-test] date=${date} remainingBefore=${remainingBefore} requestCount=${requestCount}`);

  const results = await Promise.all(
    Array.from({ length: requestCount }, (_, i) => attemptReservation(date, i))
  );

  const succeeded = results.filter((r) => r.status === 201);
  const soldOut = results.filter((r) => r.status === 409);
  const others = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log(`成功(201): ${succeeded.length}件`);
  console.log(`満車エラー(409): ${soldOut.length}件`);
  if (others.length > 0) {
    console.log(`想定外のレスポンス: ${others.length}件`);
    for (const o of others) console.log(o);
  }

  const remainingAfter = await getRemaining(date);
  console.log(`[concurrency-test] remainingAfter=${remainingAfter}`);

  const expectedSuccess = Math.min(remainingBefore, requestCount);
  const pass =
    succeeded.length === expectedSuccess &&
    others.length === 0 &&
    remainingAfter === Math.max(remainingBefore - succeeded.length, 0);

  if (pass) {
    console.log(`\n✅ PASS: 在庫(${remainingBefore}台)を超えて仮押さえが作られませんでした`);
  } else {
    console.error(
      `\n❌ FAIL: 期待した成功件数=${expectedSuccess}, 実際=${succeeded.length}`
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
