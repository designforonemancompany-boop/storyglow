import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { ownedStory } from "@/lib/firestore-data";
import { firestore } from "@/lib/firebase/admin";
import { signMediaPath } from "@/lib/media";
import { renderNarrationAsset } from "@/lib/narration";

export const maxDuration = 120;

const BodySchema = z.object({ pageNumber: z.number().int().min(1).max(12) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireApiUser();
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    if (!await ownedStory(user.uid, id)) return NextResponse.json({ error: "Story not found" }, { status: 404 });

    const pageRef = firestore().collection("stories").doc(id).collection("pages")
      .doc(String(parsed.data.pageNumber).padStart(2, "0"));
    const page = await pageRef.get();
    if (!page.exists) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    let narrationPath = page.data()?.narration_path as string | null;
    if (!narrationPath) {
      const rendered = await renderNarrationAsset({
        userId: user.uid,
        storyId: id,
        pageNumber: parsed.data.pageNumber,
        title: page.data()?.title,
        body: [
          page.data()?.body,
          page.data()?.audio_scene_plan ? `Audio drama direction: ${page.data()?.audio_scene_plan}` : "",
          Array.isArray(page.data()?.effect_cues) && page.data()?.effect_cues.length ? `Gentle effects to imply vocally: ${page.data()?.effect_cues.join(", ")}` : "",
        ].filter(Boolean).join("\n\n"),
      });
      narrationPath = rendered.narrationPath;
      await pageRef.update({
        narration_path: narrationPath,
        narration_duration_ms: rendered.narrationDurationMs,
      });
    }
    return NextResponse.json({ narrationUrl: await signMediaPath(narrationPath) });
  } catch (error) {
    const status = error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Sign in required" : "Narration failed" }, { status });
  }
}
