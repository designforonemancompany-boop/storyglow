import { FieldValue } from "firebase-admin/firestore";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { ownedStory, storyPages } from "@/lib/firestore-data";
import { firestore, storageBucket } from "@/lib/firebase/admin";
import { generateStandalonePageIllustration } from "@/lib/google-ai";
import { renderNarrationAsset } from "@/lib/narration";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SelectCoverSchema = z.object({ optionId: z.string().min(2).max(80) });

async function generateInteriorMedia({
  storyId,
  userId,
  visualStyleLock,
}: {
  storyId: string;
  userId: string;
  visualStyleLock: string;
}) {
  const story = await ownedStory(userId, storyId);
  if (!story) return;
  const pages = await storyPages(storyId);
  const storyRef = firestore().collection("stories").doc(storyId);
  const retryFlags: string[] = [];

  for (let index = 0; index < pages.length; index += 3) {
    const group = pages.slice(index, index + 3);
    const images = await Promise.allSettled(group.map(page =>
      generateStandalonePageIllustration(
        story.brief,
        page.title,
        page.scene_description || page.body,
        page.page_number,
        visualStyleLock,
      ),
    ));

    for (let offset = 0; offset < group.length; offset += 1) {
      const page = group[offset];
      const image = images[offset];
      if (image.status === "fulfilled") {
        const path = `story-media/${userId}/${storyId}/page-${page.page_number}.png`;
        await storageBucket().file(path).save(image.value, {
          resumable: false,
          contentType: "image/png",
          metadata: { cacheControl: "private,max-age=3600", metadata: { ownerId: userId, storyId } },
        });
        await storyRef.collection("pages").doc(String(page.page_number).padStart(2, "0")).set({
          illustration_path: path,
        }, { merge: true });
      } else {
        retryFlags.push(`page_${page.page_number}_illustration_retry_needed`);
        console.warn("Selected-style page illustration failed", {
          storyId,
          userId,
          pageNumber: page.page_number,
          message: image.reason instanceof Error ? image.reason.message : "UNKNOWN",
        });
      }
    }
  }

  const narrationWarmupFailures: string[] = [];
  const warmupPages = pages.slice(0, Math.min(2, pages.length));
  const narrationResults = await Promise.allSettled(warmupPages.map(page =>
    renderNarrationAsset({
      userId,
      storyId,
      pageNumber: page.page_number,
      title: page.title,
      body: page.body,
    }),
  ));
  for (let index = 0; index < narrationResults.length; index += 1) {
    const result = narrationResults[index];
    const page = warmupPages[index];
    if (result.status === "fulfilled") {
      await storyRef.collection("pages").doc(String(page.page_number).padStart(2, "0")).set({
        narration_path: result.value.narrationPath,
        narration_duration_ms: result.value.narrationDurationMs,
      }, { merge: true });
    } else {
      narrationWarmupFailures.push(`page_${page.page_number}`);
    }
  }

  await Promise.all([
    storyRef.set({
      media_generation_status: retryFlags.length || narrationWarmupFailures.length ? "needs_retry" : "ready",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true }),
    firestore().collection("generationReviews").doc(storyId).set({
      owner_id: userId,
      story_id: storyId,
      status: retryFlags.length || narrationWarmupFailures.length ? "needs_manual_review" : "passed",
      flags: [
        ...retryFlags,
        ...(narrationWarmupFailures.length ? ["narration_warmup_retry_needed"] : []),
      ],
      notes: retryFlags.length
        ? "Some interior illustrations need another pass, but the story text and selected cover are ready."
        : "Selected cover style was applied to interior page generation.",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true }),
  ]);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const parsed = SelectCoverSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid cover option." }, { status: 400 });

    const story = await ownedStory(user.uid, id);
    if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });
    if (!["ready", "archived"].includes(story.status)) {
      return NextResponse.json({ error: "Story text is not ready yet." }, { status: 409 });
    }

    const storyRef = firestore().collection("stories").doc(id);
    const optionRef = storyRef.collection("coverOptions").doc(parsed.data.optionId);
    const option = await optionRef.get();
    const optionData = option.data();
    if (!option.exists || optionData?.owner_id !== user.uid || !optionData.image_path) {
      return NextResponse.json({ error: "Cover option not found." }, { status: 404 });
    }

    const allOptions = await storyRef.collection("coverOptions").get();
    const batch = firestore().batch();
    allOptions.docs.forEach(doc => batch.set(doc.ref, {
      selected: doc.id === parsed.data.optionId,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true }));
    batch.set(storyRef, {
      cover_path: optionData.image_path,
      selected_cover_option_id: parsed.data.optionId,
      visual_style_lock: optionData.visual_style_lock || optionData.prompt_summary || "",
      cover_choice_status: "selected",
      media_generation_status: "generating",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();

    after(() => generateInteriorMedia({
      storyId: id,
      userId: user.uid,
      visualStyleLock: optionData.visual_style_lock || optionData.prompt_summary || "",
    }));

    return NextResponse.json({ selected: true, optionId: parsed.data.optionId }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    return NextResponse.json({ error: "Could not choose this cover." }, { status: 500 });
  }
}