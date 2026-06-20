import { FieldValue } from "firebase-admin/firestore";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { firestore, storageBucket } from "@/lib/firebase/admin";
import {
  COVER_STYLE_OPTIONS,
  buildVisualStyleLock,
  generateCoverOptionIllustration,
  generateStoryText,
} from "@/lib/google-ai";
import { selectStoryEntitlement, type StoryEntitlement } from "@/lib/story-entitlements";
import type { StoryBrief, StoryPageRecord } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BriefSchema = z.object({
  childName: z.string().trim().min(1).max(40),
  age: z.coerce.number().int().min(2).max(8),
  gender: z.enum(["girl", "boy", "self"]),
  grownUps: z.string().trim().max(160),
  event: z.string().trim().min(5).max(800),
  memory: z.string().trim().min(5).max(800),
  characterTraits: z.string().trim().min(3).max(500),
  photoPath: z.string().max(500).optional(),
  familyRoles: z.array(z.object({
    marker: z.number().int().min(1).max(12),
    role: z.enum(["main_character", "parent_guardian", "sibling"]),
    displayName: z.string().max(60).optional(),
  })).max(12).optional(),
}).superRefine((brief, context) => {
  if (!brief.photoPath) return;
  const roles = brief.familyRoles || [];
  if (!roles.some(role => role.role === "main_character")) {
    context.addIssue({ code: "custom", path: ["familyRoles"], message: "Label the main character in the photo." });
  }
  if (!roles.some(role => role.role === "parent_guardian")) {
    context.addIssue({ code: "custom", path: ["familyRoles"], message: "Label at least one parent or guardian." });
  }
});

async function cleanupRawFamilyPhoto({
  storyId,
  userId,
  brief,
  deletionStatus = "deleted",
}: {
  storyId: string;
  userId: string;
  brief: StoryBrief;
  deletionStatus?: string;
}) {
  if (!brief.photoPath) return;
  const expectedPrefix = `family-uploads/${userId}/`;
  if (!brief.photoPath.startsWith(expectedPrefix)) return;
  const db = firestore();
  await db.collection("familyPhotoAudits").add({
    user_id: userId,
    story_id: storyId,
    storage_path: brief.photoPath,
    role_labels: brief.familyRoles || [],
    consent_version: "2026-06-14-v1",
    deletion_status: "pending",
    uploaded_at: FieldValue.serverTimestamp(),
  }).catch(() => undefined);
  await storageBucket().file(brief.photoPath).delete({ ignoreNotFound: true }).catch(() => undefined);
  const audits = await db.collection("familyPhotoAudits")
    .where("story_id", "==", storyId).where("storage_path", "==", brief.photoPath).get()
    .catch(() => null);
  await Promise.all(audits?.docs.map(doc => doc.ref.update({
    deleted_at: FieldValue.serverTimestamp(),
    deletion_status: deletionStatus,
  }).catch(() => undefined)) || []);
}

async function markGenerationFailed({
  storyId,
  userId,
  brief,
  entitlement,
  error,
  stage,
}: {
  storyId: string;
  userId: string;
  brief: StoryBrief;
  entitlement: StoryEntitlement;
  error: unknown;
  stage?: string;
}) {
  await cleanupRawFamilyPhoto({ storyId, userId, brief, deletionStatus: "deleted_after_failure" });

  const db = firestore();
  await db.runTransaction(async transaction => {
    const storyRef = db.collection("stories").doc(storyId);
    const profileRef = db.collection("profiles").doc(userId);
    const story = await transaction.get(storyRef);
    if (!story.exists) return;
    const data = story.data() || {};
    if (!data.entitlement_refunded) {
      transaction.set(profileRef, {
        ...(entitlement === "free"
          ? { freeStoriesUsed: FieldValue.increment(-1) }
          : { storybookCredits: FieldValue.increment(1) }),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    transaction.set(storyRef, {
      status: "failed",
      entitlement_refunded: true,
      error_code: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN",
      error_stage: stage || "unknown",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
  }).catch(() => undefined);

  const [partialFiles] = await storageBucket().getFiles({
    prefix: `story-media/${userId}/${storyId}/`,
  }).catch(() => [[]]);
  await Promise.all(partialFiles.map(file =>
    file.delete({ ignoreNotFound: true }).catch(() => undefined),
  ));
}

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

async function completeStoryGeneration({
  storyId,
  userId,
  brief,
  entitlement,
}: {
  storyId: string;
  userId: string;
  brief: StoryBrief;
  entitlement: StoryEntitlement;
}) {
  let generationStage = "starting";
  let storyCommitted = false;
  try {
    const db = firestore();

    generationStage = "story_text_result";
    const book = await generateStoryText(brief);
    const pageRecords: Array<Omit<StoryPageRecord, "id" | "story_id"> & { created_at: FirebaseFirestore.FieldValue }> =
      book.pages.map((page, index) => ({
        page_number: index + 1,
        title: page.title,
        body: page.text,
        scene_description: page.sceneDescription,
        illustration_path: null,
        narration_path: null,
        narration_duration_ms: null,
        created_at: FieldValue.serverTimestamp(),
      }));

    generationStage = "firestore_text_commit";
    const batch = db.batch();
    const storyRef = db.collection("stories").doc(storyId);
    for (const page of pageRecords) {
      batch.set(storyRef.collection("pages").doc(String(page.page_number).padStart(2, "0")), page);
    }
    batch.update(storyRef, {
      title: book.title,
      dedication: book.dedication,
      cover_path: null,
      cover_prompt_version: "storybook-cover-options-v1",
      cover_choice_status: "generating",
      selected_cover_option_id: null,
      visual_style_lock: null,
      family_character_id: null,
      character_reference_path: null,
      media_generation_status: "generating",
      status: "ready",
      updated_at: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    storyCommitted = true;

    await cleanupRawFamilyPhoto({ storyId, userId, brief });

    try {
      generationStage = "cover_options_generation";
      await generateCoverChoices({
        storyId,
        userId,
        brief,
        title: book.title,
        dedication: book.dedication,
        emotionalHook: book.pages[0]?.sceneDescription || brief.memory,
      });
    } catch (error) {
      console.warn("Cover choices failed; story text remains readable", {
        storyId,
        userId,
        message: error instanceof Error ? error.message : "UNKNOWN",
      });
      await storyRef.set({
        cover_choice_status: "needs_retry",
        media_generation_status: "needs_retry",
        error_code: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN",
        error_stage: generationStage,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  } catch (error) {
    console.error("Story generation failed", {
      storyId,
      userId,
      stage: generationStage,
      message: error instanceof Error ? error.message : "UNKNOWN",
    });
    if (storyCommitted) {
      await firestore().collection("stories").doc(storyId).set({
        media_generation_status: "needs_retry",
        error_code: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN",
        error_stage: generationStage,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => undefined);
      return;
    }
    await markGenerationFailed({ storyId, userId, brief, entitlement, error, stage: generationStage });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const parsed = BriefSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const brief = parsed.data as StoryBrief;
    const db = firestore();
    const storyRef = db.collection("stories").doc();
    const storyId = storyRef.id;
    let entitlement: StoryEntitlement | null = null;
    await db.runTransaction(async transaction => {
      const profileRef = db.collection("profiles").doc(user.uid);
      const storiesQuery = db.collection("stories").where("owner_id", "==", user.uid);
      const [profile, existing] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(storiesQuery),
      ]);
      if (existing.docs.some(doc => doc.data().status === "generating")) {
        throw new Error("STORY_ALREADY_GENERATING");
      }
      const profileData = profile.data() || {};
      entitlement = selectStoryEntitlement({
        freeStoriesUsed: typeof profileData.freeStoriesUsed === "number"
          ? profileData.freeStoriesUsed
          : undefined,
        storybookCredits: Number(profileData.storybookCredits || 0),
        hasExistingStory: existing.docs.some(doc => doc.data().status !== "failed"),
      });
      if (!entitlement) throw new Error("STORY_CREDIT_REQUIRED");

      transaction.set(profileRef, {
        ...(entitlement === "free"
          ? { freeStoriesUsed: 1 }
          : { storybookCredits: FieldValue.increment(-1) }),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(storyRef, {
        owner_id: user.uid,
        brief,
        title: "Writing your story...",
        dedication: "",
        status: "generating",
        generation_entitlement: entitlement,
        entitlement_refunded: false,
        cover_path: null,
        cover_choice_status: "not_started",
        media_generation_status: null,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    });

    const reservedEntitlement = entitlement;
    if (!reservedEntitlement) throw new Error("STORY_CREDIT_REQUIRED");
    after(() => completeStoryGeneration({
      storyId,
      userId: user.uid,
      brief,
      entitlement: reservedEntitlement,
    }));
    return NextResponse.json({ storyId, status: "generating" }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "STORY_CREDIT_REQUIRED") {
      return NextResponse.json({
        error: "Your free story has been used. Earn or purchase a premium storybook credit to create another.",
      }, { status: 402 });
    }
    if (error instanceof Error && error.message === "STORY_ALREADY_GENERATING") {
      return NextResponse.json({ error: "Another story is still being created for this account." }, { status: 409 });
    }
    const message = error instanceof Error && error.message === "STORY_INPUT_BLOCKED"
      ? "Please revise these details for a child-safe story."
      : "Story generation did not finish. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}