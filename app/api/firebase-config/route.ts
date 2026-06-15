import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = publicEnv();
  return NextResponse.json({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}

