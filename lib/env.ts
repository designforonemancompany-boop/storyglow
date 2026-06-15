import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(10),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(3),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(3),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(3),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(3),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

const serverSchema = publicSchema.extend({
  FIREBASE_PROJECT_ID: z.string().min(3).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(40).optional(),
  FIREBASE_STORAGE_BUCKET: z.string().min(3),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(20),
  GEMINI_TEXT_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_IMAGE_MODEL: z.string().default("gemini-3.1-flash-image-preview"),
  GEMINI_TTS_MODEL: z.string().default("gemini-2.5-flash-preview-tts"),
  FEEDBACK_WEBHOOK_URL: z.string().url().optional(),
  FEEDBACK_WEBHOOK_SECRET: z.string().min(16).optional(),
  STRIPE_SECRET_KEY: z.string().min(16).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(16).optional(),
  PHYSICAL_BOOK_PRICE_CENTS: z.coerce.number().int().min(1000).default(4900),
  PHYSICAL_BOOK_SHIPPING_CENTS: z.coerce.number().int().min(0).default(800),
});

export function publicEnv() {
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    || [
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY_PART_1,
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY_PART_2,
    ].filter(Boolean).join("");

  return publicSchema.parse({
    NEXT_PUBLIC_FIREBASE_API_KEY: firebaseApiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

export function serverEnv() {
  return serverSchema.parse({
    ...publicEnv(),
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || undefined,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || undefined,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || undefined,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GEMINI_TEXT_MODEL: process.env.GEMINI_TEXT_MODEL,
    GEMINI_IMAGE_MODEL: process.env.GEMINI_IMAGE_MODEL,
    GEMINI_TTS_MODEL: process.env.GEMINI_TTS_MODEL,
    FEEDBACK_WEBHOOK_URL: process.env.FEEDBACK_WEBHOOK_URL || undefined,
    FEEDBACK_WEBHOOK_SECRET: process.env.FEEDBACK_WEBHOOK_SECRET || undefined,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || undefined,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || undefined,
    PHYSICAL_BOOK_PRICE_CENTS: process.env.PHYSICAL_BOOK_PRICE_CENTS,
    PHYSICAL_BOOK_SHIPPING_CENTS: process.env.PHYSICAL_BOOK_SHIPPING_CENTS,
  });
}
