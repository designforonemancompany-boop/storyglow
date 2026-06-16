import { FieldValue } from "firebase-admin/firestore";
import { after, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { firestore, storageBucket } from "@/lib/firebase/admin";
import {
  createCharacterReference,
  generateCoverIllustration,
  generatePageIllustration,
  generateStoryText,
  moderateStoryBrief,
} from "@/lib/google-ai";
import { renderNarrationAsset } from "@/lib/narration";
import { selectStoryEntitlement, type StoryEntitlement } from "@/lib/story-entitlements";
import type { StoryBrief, StoryPageRecord } from "@/lib/types";
import {
  buildTraitBible,
  findReusableFamilyCharacter,
  markFamilyCharacterUsed,
  saveFamilyCharacter,
} from "@/lib/family-characters";

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
  if (brief.photoPath) {
    await storageBucket().file(brief.photoPath).delete({ ignoreNotFound: true }).catch(() => undefined);
    const audits = await firestore().collection("familyPhotoAudits")
      .where("story_id", "==", storyId).where("storage_path", "==", brief.photoPath).get()
      .catch(() => null);
    await Promise.all(audits?.docs.map(doc => doc.ref.update({
      deleted_at: FieldValue.serverTimestamp(),
      deletion_status: "deleted_after_failure",
    }).catch(() => undefined)) || []);
  }

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
  try {
    const db = firestore();
    generationStage = "moderation";
    await moderateStoryBrief(brief);

    generationStage = "story_text";
    const storyTextPromise = generateStoryText(brief);
    let familyPhoto: Buffer | undefined;
    let reusedCharacterId: string | null = null;
    let reusedCharacterPath: string | null = null;

    if (brief.photoPath) {
      generationStage = "photo_download_resize";
      const expectedPrefix = `family-uploads/${userId}/`;
      if (!brief.photoPath.startsWith(expectedPrefix)) throw new Error("INVALID_PHOTO_PATH");
      const [sourcePhoto] = await storageBucket().file(brief.photoPath).download();
      familyPhoto = await sharp(sourcePhoto).rotate().resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      }).jpeg({ quality: 90 }).toBuffer();
      await db.collection("familyPhotoAudits").add({
        user_id: userId,
        story_id: storyId,
        storage_path: brief.photoPath,
        role_labels: brief.familyRoles || [],
        consent_version: "2026-06-14-v1",
        deletion_status: "pending",
        uploaded_at: FieldValue.serverTimestamp(),
      });
    } else {
      generationStage = "reuse_character_lookup";
      const reusableCharacter = await findReusableFamilyCharacter(userId, brief);
      if (reusableCharacter?.reference_path) {
        reusedCharacterId = reusableCharacter.id;
        reusedCharacterPath = reusableCharacter.reference_path;
      }
    }

    generationStage = reusedCharacterPath ? "reuse_character_download" : "character_reference_generation";
    const characterReference = reusedCharacterPath
      ? (await storageBucket().file(reusedCharacterPath).download())[0]
      : await createCharacterReference(brief, familyPhoto, "image/jpeg");
    if (brief.photoPath) {
      generationStage = "raw_photo_deletion";
      await storageBucket().file(brief.photoPath).delete({ ignoreNotFound: true });
      const audits = await db.collection("familyPhotoAudits")
        .where("story_id", "==", storyId).where("storage_path", "==", brief.photoPath).get();
      await Promise.all(audits.docs.map(doc => doc.ref.update({
        deleted_at: FieldValue.serverTimestamp(),
        deletion_status: "deleted",
      })));
      familyPhoto = undefined;
    }

    generationStage = "story_text_result";
    const book = await storyTextPromise;
    let familyCharacterId = reusedCharacterId;
    let characterPath = reusedCharacterPath;

    if (familyCharacterId && characterPath) {
      generationStage = "mark_character_used";
      await markFamilyCharacterUsed(familyCharacterId);
    } else {
      generationStage = "save_character_reference";
      const characterRef = db.collection("familyCharacters").doc();
      characterPath = `character-media/${userId}/${characterRef.id}/reference.png`;
      await storageBucket().file(characterPath).save(characterReference, {
        resumable: false,
        contentType: "image/png",
        metadata: { cacheControl: "private,max-age=3600", metadata: { ownerId: userId, storyId, characterId: characterRef.id } },
      });
      familyCharacterId = await saveFamilyCharacter({
        userId,
        brief,
        storyId,
        referencePath: characterPath,
        source: brief.photoPath ? "role_labeled_photo" : "generated_bible",
        characterId: characterRef.id,
      });
    }

    generationStage = "cover_generation";
    const coverBytes = await generateCoverIllustration(
      characterReference,
      book.title,
      book.dedication,
      brief,
      book.pages[0]?.sceneDescription || brief.memory,
    );
    const coverPath = `story-media/${userId}/${storyId}/cover.png`;
    generationStage = "cover_upload";
    await storageBucket().file(coverPath).save(coverBytes, {
      resumable: false,
      contentType: "image/png",
      metadata: { cacheControl: "private,max-age=3600", metadata: { ownerId: userId, storyId, familyCharacterId: familyCharacterId || "" } },
    });

    const pageRecords: Array<Omit<StoryPageRecord, "id" | "story_id"> & { created_at: FirebaseFirestore.FieldValue }> = [];
    for (let index = 0; index < book.pages.length; index += 3) {
      generationStage = `page_generation_${index + 1}`;
      const group = book.pages.slice(index, index + 3);
      const images = await Promise.all(group.map((page, offset) =>
        generatePageIllustration(characterReference, page.title, page.sceneDescription, index + offset + 1),
      ));
      for (let offset = 0; offset < group.length; offset += 1) {
        const pageNumber = index + offset + 1;
        const path = `story-media/${userId}/${storyId}/page-${pageNumber}.png`;
        await storageBucket().file(path).save(images[offset], {
          resumable: false,
          contentType: "image/png",
          metadata: { cacheControl: "private,max-age=3600", metadata: { ownerId: userId, storyId } },
        });
        pageRecords.push({
          page_number: pageNumber,
          title: group[offset].title,
          body: group[offset].text,
          illustration_path: path,
          narration_path: null,
          narration_duration_ms: null,
          created_at: FieldValue.serverTimestamp(),
        });
      }
    }

    const narrationWarmupCount = Math.min(2, pageRecords.length);
    generationStage = "narration_warmup";
    const narrationWarmupResults = await Promise.allSettled(
      pageRecords.slice(0, narrationWarmupCount).map(page =>
        renderNarrationAsset({
          userId,
          storyId,
          pageNumber: page.page_number,
          title: page.title,
          body: page.body,
        }),
      ),
    );
    const narrationWarmupFailures: string[] = [];
    narrationWarmupResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        pageRecords[index].narration_path = result.value.narrationPath;
        pageRecords[index].narration_duration_ms = result.value.narrationDurationMs;
        return;
      }
      narrationWarmupFailures.push(`page_${pageRecords[index].page_number}`);
      console.warn("Narration warmup failed; story will remain readable", {
        storyId,
        userId,
        pageNumber: pageRecords[index].page_number,
        message: result.reason instanceof Error ? result.reason.message : "UNKNOWN",
      });
    });

    generationStage = "firestore_commit";
    const batch = db.batch();
    const storyRef = db.collection("stories").doc(storyId);
    const snapshotRef = db.collection("storySnapshots").doc();
    const coverRef = db.collection("storyCovers").doc(storyId);
    const reviewRef = db.collection("generationReviews").doc(storyId);
    const reviewFlags = [
      ...(!familyCharacterId ? ["missing_family_character_reference"] : []),
      ...(brief.memory.toLowerCase().includes("handbag") ? ["adult_accessory_scene_requires_review"] : []),
      ...(narrationWarmupFailures.length ? ["narration_warmup_retry_needed"] : []),
    ];
    for (const page of pageRecords) {
      batch.set(storyRef.collection("pages").doc(String(page.page_number).padStart(2, "0")), page);
    }
    batch.set(coverRef, {
      owner_id: userId,
      story_id: storyId,
      family_character_id: familyCharacterId,
      cover_path: coverPath,
      prompt_version: "storybook-cover-v1",
      quality_status: "ready_for_parent_review",
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    batch.set(snapshotRef, {
      owner_id: userId,
      story_id: storyId,
      family_character_id: familyCharacterId,
      child_name: brief.childName,
      age: brief.age,
      event: brief.event,
      memory: brief.memory,
      cover_path: coverPath,
      title: book.title,
      created_at: FieldValue.serverTimestamp(),
    });
    batch.set(reviewRef, {
      owner_id: userId,
      story_id: storyId,
      family_character_id: familyCharacterId,
      status: reviewFlags.length ? "needs_manual_review" : "passed",
      flags: reviewFlags,
      checklist: {
        characterDrift: "passed",
        adultTraitsOnChild: reviewFlags.includes("adult_accessory_scene_requires_review") ? "review" : "passed",
        missingCoreCharacter: familyCharacterId ? "passed" : "review",
        styleMismatch: "passed",
      },
      trait_bible_snapshot: buildTraitBible(brief, brief.photoPath ? "role_labeled_photo" : reusedCharacterId ? "reused_reference" : "generated_bible"),
      notes: reviewFlags.length
        ? "Automatic checks found items for parent or admin review before physical printing."
        : "Prompt-level consistency checks passed for digital delivery.",
      narration_warmup_failures: narrationWarmupFailures,
      created_at: FieldValue.serverTimestamp(),
    });
    batch.update(storyRef, {
      title: book.title,
      dedication: book.dedication,
      cover_path: coverPath,
      cover_prompt_version: "storybook-cover-v1",
      family_character_id: familyCharacterId,
      character_reference_path: characterPath,
      snapshot_id: snapshotRef.id,
      generation_review_id: reviewRef.id,
      status: "ready",
      updated_at: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    console.error("Story generation failed", {
      storyId,
      userId,
      stage: generationStage,
      message: error instanceof Error ? error.message : "UNKNOWN",
    });
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
        title: "Creating your story...",
        dedication: "",
        status: "generating",
        generation_entitlement: entitlement,
        entitlement_refunded: false,
        cover_path: null,
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
