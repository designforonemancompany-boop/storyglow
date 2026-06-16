import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    version: process.env.K_REVISION || process.env.VERCEL_GIT_COMMIT_SHA || "local",
    nodeEnv: process.env.NODE_ENV || "unknown",
    generatedAt: new Date().toISOString(),
  });
}
