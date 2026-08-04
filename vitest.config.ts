import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/setup/globalSetup.ts"],
    setupFiles: ["./tests/setup/testEnv.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    // 実DB(PGlite)を共有するテストが並行実行で競合しないよう直列実行にする
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
