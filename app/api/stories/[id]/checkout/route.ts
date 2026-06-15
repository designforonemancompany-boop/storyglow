import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireApiUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { firestore } from "@/lib/firebase/admin";
import { ownedStory } from "@/lib/firestore-data";
import { stripeClient } from "@/lib/stripe";

const SHIPPING_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] = [
  "US", "CA", "GB", "AU", "NZ", "SG",
];

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireApiUser();
    const story = await ownedStory(user.uid, id);
    if (!story || !["ready", "archived"].includes(story.status)) {
      return NextResponse.json({ error: "Completed story not found." }, { status: 404 });
    }

    const env = serverEnv();
    const stripe = stripeClient();
    const shippingOptions = env.PHYSICAL_BOOK_SHIPPING_CENTS > 0
      ? [{
        shipping_rate_data: {
          type: "fixed_amount" as const,
          display_name: "Tracked book delivery",
          fixed_amount: {
            amount: env.PHYSICAL_BOOK_SHIPPING_CENTS,
            currency: "usd",
          },
          delivery_estimate: {
            minimum: { unit: "business_day" as const, value: 7 },
            maximum: { unit: "business_day" as const, value: 14 },
          },
        },
      }]
      : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      client_reference_id: user.uid,
      metadata: {
        owner_id: user.uid,
        story_id: story.id,
        order_type: "physical_storybook",
      },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: env.PHYSICAL_BOOK_PRICE_CENTS,
          product_data: {
            name: `StoryGlow physical book: ${story.title}`,
            description: "One personalized hardcover storybook created from your private digital story.",
          },
        },
      }],
      shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
      shipping_options: shippingOptions,
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      success_url: `${env.NEXT_PUBLIC_SITE_URL}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/library?order=cancelled`,
    });
    if (!session.url) throw new Error("STRIPE_SESSION_URL_MISSING");

    await firestore().collection("checkoutSessions").doc(session.id).set({
      owner_id: user.uid,
      story_id: story.id,
      story_title: story.title,
      checkout_session_id: session.id,
      status: session.status,
      amount_subtotal: session.amount_subtotal,
      amount_total: session.amount_total,
      currency: session.currency,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED") {
      return NextResponse.json({ error: "Physical-book checkout is not configured yet." }, { status: 503 });
    }
    console.error("Physical-book checkout failed", error);
    return NextResponse.json({ error: "Could not start physical-book checkout." }, { status: 500 });
  }
}

