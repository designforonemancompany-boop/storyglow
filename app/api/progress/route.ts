import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase/admin";
import { ownedStory } from "@/lib/firestore-data";

const BodySchema = z.object({
  storyId: z.string().min(10).max(80),
  pageNumber: z.number().int().min(1).max(12),
  audioPositionMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  playbackRate: z.number().min(0.5).max(2),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid progress." }, { status: 400 });
    if (!await ownedStory(user.uid, parsed.data.storyId)) {
      return NextResponse.json({ error: "Story not found." }, { status: 404 });
    }
    await firestore().collection("profiles").doc(user.uid).collection("progress")
      .doc(parsed.data.storyId).set({
        page_number: parsed.data.pageNumber,
        audio_position_ms: parsed.data.audioPositionMs,
        playback_rate: parsed.data.playbackRate,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
    return NextResponse.json({ saved: true });
  } catch (error) {
    const status = error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Sign in required" : "Could not save progress" }, { status });
  }
}
