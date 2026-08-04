import "dotenv/config";
import { TEST_DATABASE_URL } from "./globalSetup";

// vitestはNext.jsと違い.envを自動読み込みしないため、明示的にロードする
// (STRIPE_SECRET_KEY等、lib/stripe.tsが起動時に必須チェックしている値のため)

// globalSetupが立てたPGliteサーバーを、各テストワーカーからDATABASE_URLとして見えるようにする。
// (globalSetupは別プロセスで動くため、process.envの直接共有ができない)
process.env.DATABASE_URL = TEST_DATABASE_URL;
