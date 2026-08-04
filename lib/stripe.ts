import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

// apiVersionはSDKに同梱のものをそのまま使う(明示指定はしない)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
