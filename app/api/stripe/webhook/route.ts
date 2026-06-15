import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { firestore } from "@/lib/firebase/admin";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function recordPaidOrder(session: Stripe.Checkout.Session) {
  const ownerId = session.metadata?.owner_id;
  const storyId = session.metadata?.story_id;
  if (!ownerId || !storyId || session.payment_status !== "paid") return;

  const shipping = session.collected_information?.shipping_details;
  const db = firestore();
  const orderRef = db.collection("printOrders").doc(session.id);
  const checkoutRef = db.collection("checkoutSessions").doc(session.id);
  const batch = db.batch();
  batch.set(orderRef, {
    owner_id: ownerId,
    story_id: storyId,
    checkout_session_id: session.id,
    payment_intent_id: typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null,
    payment_status: session.payment_status,
    fulfillment_status: "paid",
    amount_subtotal: session.amount_subtotal,
    amount_total: session.amount_total,
    currency: session.currency,
    customer_email: session.customer_details?.email || session.customer_email,
    customer_name: session.customer_details?.name || shipping?.name || null,
    customer_phone: session.customer_details?.phone || null,
    shipping_details: shipping || null,
    paid_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(checkoutRef, {
    status: session.status,
    payment_status: session.payment_status,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

export async function POST(request: Request) {
  const env = serverEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  try {
    const event = stripeClient().webhooks.constructEvent(
      await request.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await recordPaidOrder(event.data.object);
    }
    if (event.type === "checkout.session.async_payment_failed") {
      await firestore().collection("checkoutSessions").doc(event.data.object.id).set({
        status: event.data.object.status,
        payment_status: event.data.object.payment_status,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook rejected", error);
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }
}

