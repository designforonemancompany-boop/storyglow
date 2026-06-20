import { FieldValue } from "firebase-admin/firestore";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { ownedStory } from "@/lib/firestore-data";
import { firestore, storageBucket } from "@/lib/firebase/admin";
import {
  COVER_STYLE_OPTIONS,
  buildVisualStyleLock,
  generateCoverOptionIllustration,
} from "@/lib/google-ai";
import type { StoryBrief, StoryPageRecord } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SelectStorylineSchema = z.object({ optionId: z.string().min(2).max(80) });

type StorylineBook = {
  title: string;
  dedication: string;
  pages: Array<{
    title: string;
    text: string;
    sceneDescription: string;
    storyBeat?: string;
    audioScenePlan?: string;
    ambienceKey?: StoryPageRecord["ambience_key"];
    effectCues?: string[];
    characterVoiceHints?: string[];
  }>;
};

async function generateCoverChoices({
  storyId,
  userId,
  brief,
  title,
  dedication,
  emotionalHook,
}: {
  storyId: string;
  userId: string;
  brief: StoryBrief;
  title: string;
  dedication: string;
  emotionalHook: string;
}) {
  const db = firestore();
  const storyRef = db.collection("stories").doc(storyId);
  const results = await Promise.allSettled(COVER_STYLE_OPTIONS.map(async option => {
    const visualStyleLock = buildVisualStyleLock(brief, option);
    const bytes = await generateCoverOptionIllustration({
      title,
      dedication,
      brief,
      emotionalHook,
      option,
      visualStyleLock,
    });
    const path = `story-media/${userId}/${storyId}/cover-option-${option.id}.png`;
    await storageBucket().file(path).save(bytes, {
      resumable: false,
      contentType: "image/png",
      metadata: { cacheControl: "private,max-age=3600", metadata: { ownerId: userId, storyId, coverOptionId: option.id } },
    });
    await storyRef.collection("coverOptions").doc(option.id).set({
      owner_id: userId,
      story_id: storyId,
      option_id: option.id,
      style_label: option.label,
      prompt_summary: option.promptSummary,
      visual_style_lock: visualStyleLock,
      image_path: path,
      selected: false,
      status: "ready",
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    return option.id;
  }));

  const readyCount = results.filter(result => result.status === "fulfilled").length;
  const failedOptions = results
    .map((result, index) => result.status === "rejected" ? COVER_STYLE_OPTIONS[index].id : null)
    .filter(Boolean);

  await storyRef.set({
    cover_choice_status: readyCount ? "ready" : "needs_retry",
    media_generation_status: readyCount ? "awaiting_cover_choice" : "needs_retry",
    cover_option_failures: failedOptions,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const parsed = SelectStorylineSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid storyline." }, { status: 400 });

    const story = await ownedStory(user.uid, id);
    if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });
    if (!story.brief || !["ready", "archived"].includes(story.status)) {
      return NextResponse.json({ error: "Storyline choices are not ready yet." }, { status: 409 });
    }

    const storyRef = firestore().collection("stories").doc(id);
    const optionRef = storyRef.collection("storylineOptions").doc(parsed.data.optionId);
    const option = await optionRef.get();
    const optionData = option.data();
    if (!option.exists || optionData?.owner_id !== user.uid || !optionData.book) {
      return NextResponse.json({ error: "Storyline option not found." }, { status: 404 });
    }
    const book = optionData.book as StorylineBook;
    const allOptions = await storyRef.collection("storylineOptions").get();
    const existingPages = await storyRef.collection("pages").get();
    const batch = firestore().batch();
    existingPages.docs.forEach(doc => batch.delete(doc.ref));
    allOptions.docs.forEach(doc => batch.set(doc.ref, {
      selected: doc.id === parsed.data.optionId,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true }));
    book.pages.forEach((page, index) => {
      batch.set(storyRef.collection("pages").doc(String(index + 1).padStart(2, "0")), {
        page_number: index + 1,
        title: page.title,
        body: page.text,
        scene_description: page.sceneDescription,
        story_beat: page.storyBeat || null,
        audio_scene_plan: page.audioScenePlan || null,
        ambience_key: page.ambienceKey || null,
        effect_cues: page.effectCues || [],
        character_voice_hints: page.characterVoiceHints || [],
        illustration_path: null,
        narration_path: null,
        narration_duration_ms: null,
        created_at: FieldValue.serverTimestamp(),
      });
    });
    batch.set(storyRef, {
      title: book.title,
      dedication: book.dedication,
      storyline_choice_status: "selected",
      selected_storyline_option_id: parsed.data.optionId,
      cover_choice_status: "generating",
      cover_path: null,
      media_generation_status: "generating",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();

    after(() => generateCoverChoices({
      storyId: id,
      userId: user.uid,
      brief: story.brief,
      title: book.title,
      dedication: book.dedication,
      emotionalHook: book.pages[0]?.sceneDescription || story.brief.memory,
    }));

    return NextResponse.json({ selected: true, optionId: parsed.data.optionId }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    return NextResponse.json({ error: "Could not choose this storyline." }, { status: 500 });
  }
}
