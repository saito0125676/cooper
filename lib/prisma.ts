import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Next.jsの開発モードはファイル変更のたびにモジュールを再評価するため、
// グローバルにキャッシュしてPrismaClientの多重生成(コネクション枯渇)を防ぐ
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // テスト環境などでコネクションプールの上限を明示的に絞りたい場合のためのオプション項目。
    // 未設定時はpgのデフォルト(max: 10)のまま。
    max: process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : undefined,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
