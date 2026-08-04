# テストケース一覧(二重予約防止まわり中心)

## 自動化されているテスト

`npm test` を実行すると、実際にPostgres互換DB(PGlite。Docker不要でCIでもそのまま動く使い捨てDB)に
接続した状態で単体テスト+結合テストが一括で走ります(`tests/setup/globalSetup.ts`が自動的に
テスト用DBを起動してスキーマを反映し、終了時に破棄します)。

| # | ファイル | 内容 |
|---|----------|------|
| 1 | `tests/reservations.unit.test.ts` | 日付パースの境界値検証(不正フォーマット/実在しない日付/過去日付/今日はOK) |
| 2 | `tests/customerInfo.unit.test.ts` | 予約者情報の入力チェック(必須項目/メール再入力一致/ひらがな/未来日付NG等) |
| 3 | `tests/integration/doubleBooking.integration.test.ts` | **二重予約防止**。容量超過の同時リクエスト、残り1台での2人同時押し、異なる日付は独立して処理されること |
| 4 | `tests/integration/holdTimeout.integration.test.ts` | **仮押さえのタイムアウト**。15分経過後の自動失効、在庫の復帰、Cronの冪等性(2回実行しても壊れない)、Webhook確定とタイムアウト処理の競合(順序が入れ替わっても矛盾しない) |
| 5 | `tests/integration/webhook.integration.test.ts` | **Webhookの重複配信対策と署名検証**。同一event.idの二重配信が無視されること、署名検証(正常/改ざん/シークレット不一致/デタラメ)の合否 |
| 6 | `tests/integration/dataIntegrity.integration.test.ts` | **データ不整合の防止**。status/paymentStatusのあり得ない組み合わせが存在しないこと、満車失敗時に中途半端な行が残らないこと |
| 7 | `tests/integration/security.integration.test.ts` | **入力値・金額改ざん耐性**。SQLインジェクション/XSS文字列の安全な保存、クライアントが送った金額を無視してサーバー固定金額が使われること |
| 8 | `tests/integration/smoke.integration.test.ts` | テストDB自体の疎通確認 |
| 9 | `tests/integration/paymentFailure.integration.test.ts` | **決済失敗・離脱時の挙動**。カード拒否等で`paymentStatus=failed`になっても予約(在庫)は残ること、ブラウザを閉じるなど何も通知が来ないケースでも15分後のタイムアウトで確実に在庫が解放されること |
| 10 | `tests/integration/idempotency.integration.test.ts` | **冪等キーの正しさ**(ボタン連打・複数タブ対策)と**Webhook処理失敗からの再送リカバリー**。Stripe呼び出しに渡る`idempotencyKey`がDB上の値と一致すること、別々の予約が異なるキーを使い取り違えが起きないこと、処理失敗時にロールバックされ再送で正しく完了すること |

Stripeのホスト決済画面(カード拒否時のエラー表示など)自体は当システムの実装範囲外のため、
自動テストの対象にしていません。

別途、実際に起動したNext.jsサーバーに対してHTTP経由で行う結合テストとして以下も用意しています。

| # | 種別 | コマンド | 内容 |
|---|------|----------|------|
| 9 | 結合テスト(要DB+サーバー起動) | `npm run test:concurrency` | 残り台数を超える件数の予約リクエストを**完全同時**に送り、成功件数が残り台数ちょうどになることを検証 |

## 手動 / シナリオベースのテストケース

| # | シナリオ | 期待結果 |
|---|----------|----------|
| A | 残り台数がある日に予約 | 仮押さえが作られ、Stripe CheckoutのURLが返る(201) |
| B | 残り台数0の日に予約 | 409エラー、仮押さえは作られない |
| C | **同じ日付に対して同時に11件リクエスト(残り10台)** | 成功10件・満車エラー1件。DBに`pending_hold`+`confirmed`の合計が容量を超えない | 
| D | 仮押さえ後、15分以内に決済完了 | Webhookで`status=confirmed`, `paymentStatus=paid`になる |
| E | 仮押さえ後、15分間決済しない | 在庫計算(`activeReservationWhere`)がholdStartedAtで自動的に除外するため、Cron実行前でも新しい予約に空きが再利用される。Cron実行後は`status=expired`に整地される |
| F | Stripe Webhookが同じイベントを2回配信 | `ProcessedWebhookEvent`のユニーク制約により2回目は`duplicate: true`を返し、予約は二重に更新されない |
| G | Webhookの署名が不正 | 400を返し、一切DBを更新しない |
| H | `checkout.sessions.create`をネットワーク瞬断などでサーバーが再試行 | 同一予約の`idempotencyKey`を使っているため、Stripe側で同じCheckout Session/PaymentIntentが返り、二重の支払いは発生しない |
| I | 決済失敗(`payment_intent.payment_failed`) | `paymentStatus=failed`になるが`status`は`pending_hold`のまま(15分以内なら顧客はCheckoutページで別カードに再挑戦できる) |
| J | 仮押さえがCronで`expired`になった直後にStripe側の決済が完了(15分ルール vs Stripeの最短30分ルールの隙間) | 在庫を横取りしてconfirmedにはせず、`paymentStatus=paid`だけ記録して要確認ログを出す(運用上は返金 or 個別手配)。Cron側でも`checkout.sessions.expire`をベストエフォートで呼び、この隙間をできるだけ小さくしている |
| K | Stripe Checkout Session作成がAPIエラーで失敗 | 直前に作った仮押さえは`cancelled`に戻し、在庫を解放する |

## Cのシナリオ(同時リクエスト)を実際に動かす手順

```bash
docker compose up -d
npx prisma migrate dev --name init
npx prisma db seed
npm run dev            # 別ターミナルで起動したままにする
npm run test:concurrency 2026-09-15 15   # 2026-09-15に対して15件同時発火
```

`✅ PASS` と表示されれば、在庫(10台)を超える仮押さえが作られなかったことを意味します。

## Stripe Webhookをローカルで試す

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# 別ターミナルで
stripe trigger checkout.session.completed
```

`stripe listen`が発行するWebhookシークレット(`whsec_...`)を`.env`の`STRIPE_WEBHOOK_SECRET`に設定してください。
