# レンタカー予約デモ

Next.js(フロントエンド/バックエンド統一) + Prisma + PostgreSQL(自社DB) + Stripe Checkout による、
1日単位のレンタカー予約デモです。

## 技術構成

- Next.js 16 (App Router, Route Handlersでバックエンド兼用)
- Prisma 7 + PostgreSQL(自前DB、外部カレンダーサービス等には非依存)
- Stripe Checkout(決済) + Stripe Webhook(決済完了通知)

## セットアップ

```bash
npm install
cp .env.example .env   # 既に.envは用意済みですが、Stripeキーは書き換えてください
```

`.env` の以下2つは自分のStripeテストアカウントの値に差し替えてください。

```
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."   # `stripe listen`実行時に表示される値
```

### DBの起動とマイグレーション

Dockerが使える場合:

```bash
docker compose up -d
npx prisma migrate dev --name init
npx prisma db seed
```

Dockerが使えない場合は、任意のPostgreSQL(バージョン14以降推奨)を用意し、
`.env`の`DATABASE_URL`を接続先に合わせて書き換えてから同じコマンドを実行してください。

### 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 で予約フォームが表示されます。

### Stripe Webhookをローカルで受け取る

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 仮押さえ失効バッチ(Cron)

15分経過して未決済の仮押さえを`expired`にするバッチです。

- Vercelにデプロイする場合は`vercel.json`の設定により1分毎に自動実行されます(`CRON_SECRET`環境変数を設定すると、Vercelが自動でその値を`Authorization: Bearer <値>`ヘッダに載せて呼び出します)。
- ローカルや他ホスティングでは、任意のCron機構(OSのタスクスケジューラ、`cron-job.org`等)から以下を1分毎に呼び出してください。

```bash
curl -X POST http://localhost:3000/api/cron/expire-holds \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 画面/APIの構成

| パス | 役割 |
|------|------|
| `/` | 予約フォーム(①日付選択→②予約者情報入力→Stripe Checkoutへ) |
| `/success` | 決済後に戻ってくるページ(予約ステータスを数秒おきに確認表示) |
| `/cancel` | 決済キャンセル時に戻ってくるページ |
| `GET /api/availability?date=YYYY-MM-DD` | 指定日の残り台数を返す |
| `GET /api/availability/month?year=YYYY&month=M` | 指定月の全日分の残り台数をまとめて返す(カレンダー表示用) |
| `POST /api/reservations` | 在庫チェック→仮押さえ作成→Stripe Checkout URL発行 |
| `GET /api/reservations/[id]` | 予約1件のステータス参照(成功画面のポーリング用) |
| `POST /api/webhooks/stripe` | Stripe Webhook受信(決済確定/失効/失敗の反映) |
| `POST /api/cron/expire-holds` | 15分超過した仮押さえを失効させるバッチ(要`CRON_SECRET`) |

## 設計のポイント

詳しくは各ファイルのコメントも参照してください。

- **二重予約防止**: [lib/reservations.ts](lib/reservations.ts) の `createHold` で、日付ごとに
  PostgreSQLのアドバイザリーロック(`pg_advisory_xact_lock`)を使い、同じ日付への
  「在庫チェック→仮押さえ作成」を1つのDBトランザクション内で直列化しています。
  異なる日付へのリクエストはロックが競合しないので並行して処理できます。
- **仮押さえのタイムアウト**: 在庫数の計算自体が「`holdStartedAt`から15分以内のpending_holdのみ」を
  カウント対象にしているため、Cronバッチの実行が多少遅れても在庫超過にはなりません。
  Cronバッチ([app/api/cron/expire-holds/route.ts](app/api/cron/expire-holds/route.ts))は
  データを`expired`状態に整えることと、Stripe Checkout Sessionを早めに閉じることが役割です。
- **Stripeの冪等性**: 仮押さえレコード作成時に発行する`idempotencyKey`を、
  `stripe.checkout.sessions.create`の`idempotencyKey`オプションとして渡しています。
  同じ予約に対してこの処理が再試行されても、Stripe側で同一のCheckout Session/PaymentIntentが
  返るため二重決済になりません。
- **Webhookの重複配信対策**: [app/api/webhooks/stripe/route.ts](app/api/webhooks/stripe/route.ts) で、
  受信したイベントID(`event.id`)を`ProcessedWebhookEvent`テーブルに記録する処理と、
  予約ステータスの更新処理を同じDBトランザクションにまとめています。
  イベントIDのINSERTがユニーク制約違反になった場合は「処理済み」と判断してスキップします。
- **予約者情報の入力チェック**: [lib/customerInfo.ts](lib/customerInfo.ts) に検証ルールを1箇所にまとめ、
  フロント([app/components/CustomerInfoForm.tsx](app/components/CustomerInfoForm.tsx))と
  API側([app/api/reservations/route.ts](app/api/reservations/route.ts))の両方で同じルールを使っています。
  自宅電話番号以外は必須、メールアドレスは再入力した値と完全一致していないとエラーになります。
  フロント側の入力チェックはブラウザ操作で回避できるため、APIでも同じ検証を必ず行っています。

## テスト

[TESTING.md](TESTING.md) を参照してください。二重予約防止を検証する同時リクエストテストは

```bash
npm run test:concurrency
```

で実行できます(事前に`npm run dev`でサーバーを起動しておく必要があります)。

## 今回のデモのスコープ外

- 複数日にまたがる期間レンタル
- 他社予約サービスとのAPI連携・同期
- お客様側でのキャンセル・変更機能
- リマインド通知(LINE/メール/SMS)
- 在庫設定を変更する管理画面のUI(`InventoryConfig`テーブルとしては用意済みなので、
  将来的に管理画面から`dailyCapacity`を更新するAPIを追加すれば対応可能)
