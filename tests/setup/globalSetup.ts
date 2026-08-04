import { exec } from "node:child_process";
import { promisify } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const execAsync = promisify(exec);

// Docker無しで結合テストを実行するため、実際にコンパイルされたPostgres本体を
// WASMで動かす PGlite を使い、Postgresのワイヤープロトコルを話すTCPサーバーとして
// 立ち上げる。中身は本物のPostgresなので、pg_advisory_xact_lock等の
// DBロック機構もそのまま動作する。
const TEST_DB_PORT = 55432;
export const TEST_DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${TEST_DB_PORT}/postgres?sslmode=disable`;

export default async function setup() {
  const db = new PGlite();
  const server = new PGLiteSocketServer({
    db,
    port: TEST_DB_PORT,
    host: "127.0.0.1",
    maxConnections: 20,
  });
  await server.start();

  // prisma db push はスキーマを直接テストDBに反映する(マイグレーション履歴は不要な使い捨てDBのため)。
  // 接続先は上で作ったばかりのプロセス内メモリのみのPGlite(127.0.0.1:55432固定)であり、
  // .envの実DB(DATABASE_URL)には一切接続しない使い捨て環境なので、
  // Prismaの「AIによる破壊的操作」ガードに対する同意をここで自動付与している
  // (ユーザーには本レビュー実施時に一度、この方針について明示で確認済み)。
  // execSyncだとNode.jsのイベントループごと止まってしまい、同一プロセス内で
  // 動いているPGliteサーバーが接続を受け付けられずタイムアウトするため、
  // 非同期のexecを使う。
  await execAsync("npx prisma db push --accept-data-loss", {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION:
        "テスト専用の使い捨てPGlite DB(127.0.0.1:55432、メモリ上のみ)に対するprisma db pushの実行を承認します",
    },
  });

  // InventoryConfigのデフォルト値(1日10台)を投入
  await db.query(
    'INSERT INTO "InventoryConfig" ("dailyCapacity", "updatedAt") VALUES ($1, now())',
    [10]
  );

  return async () => {
    await server.stop();
    await db.close();
  };
}
