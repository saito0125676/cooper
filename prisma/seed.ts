import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 在庫設定は1行(singleton)のみ。既にあれば何もしない。
  const existing = await prisma.inventoryConfig.findFirst();
  if (existing) {
    console.log("InventoryConfig は既に存在します:", existing);
    return;
  }

  const config = await prisma.inventoryConfig.create({
    data: { dailyCapacity: 10 },
  });
  console.log("InventoryConfig を作成しました:", config);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
