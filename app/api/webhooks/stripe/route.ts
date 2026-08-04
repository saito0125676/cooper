import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { processStripeEventOnce } from "@/lib/webhookHandlers";

// Route Handlerはデフォルトでbodyをパースしないので、署名検証用に生の文字列で受け取れる
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "stripe-signatureヘッダまたはWebhookシークレットがありません" },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[webhook] signature verification failed", err);
    return NextResponse.json({ error: "署名の検証に失敗しました" }, { status: 400 });
  }

  try {
    const result = await processStripeEventOnce(event);
    return NextResponse.json({ received: true, duplicate: result === "duplicate" });
  } catch (err) {
    console.error("[webhook] processing failed", event.id, event.type, err);
    // 5xxを返すとStripeが自動的に再送してくれる
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 });
  }
}
