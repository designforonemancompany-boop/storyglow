import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { firestore, storageBucket } from "@/lib/firebase/admin";
import {
  createCharacterReference,
  generatePageIllustration,
  generateStoryText,
  moderateStoryBrief,
} from "@/lib/google-ai";
import type { StoryBrief } from "@/lib/types";

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

export async function POST(request: Request) {
  let storyId = "";
  let brief: StoryBrief | null = null;
  try {
    const user = await requireApiUser();
    const parsed = BriefSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    brief = parsed.data as StoryBrief;
    const db = firestore();
    const existing = await db.collection("stories").where("owner_id", "==", user.uid).get();
    const activeCount = existing.docs.filter(doc => ["generating", "ready"].includes(doc.data().status)).length;
    if (activeCount >= 10) return NextResponse.json({ error: "Current account limit reached" }, { status: 429 });

    const storyRef = db.collection("stories").doc();
    storyId = storyRef.id;
    await storyRef.set({
      owner_id: user.uid,
      brief,
      title: "Creating your story...",
      dedication: "",
      status: "generating",
      cover_path: null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    await moderateStoryBrief(brief);
    const storyTextPromise = generateStoryText(brief);
    let familyPhoto: Buffer | undefined;

    if (brief.photoPath) {
      const expectedPrefix = `family-uploads/${user.uid}/`;
      if (!brief.photoPath.startsWith(expectedPrefix)) throw new Error("INVALID_PHOTO_PATH");
      const [sourcePhoto] = await storageBucket().file(brief.photoPath).download();
      familyPhoto = await sharp(sourcePhoto).rotate().resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      }).jpeg({ quality: 90 }).toBuffer();
      await db.collection("familyPhotoAudits").add({
        user_id: user.uid,
        story_id: storyId,
        storage_path: brief.photoPath,
        role_labels: brief.familyRoles || [],
        consent_version: "2026-06-14-v1",
        deletion_status: "pending",
        uploaded_at: FieldValue.serverTimestamp(),
      });
    }

    const characterReference = await createCharacterReference(brief, familyPhoto, "image/jpeg");
    if (brief.photoPath) {
      await storageBucket().file(brief.photoPath).delete({ ignoreNotFound: true });
      const audits = await db.collection("familyPhotoAudits")
        .where("story_id", "==", storyId).where("storage_path", "==", brief.photoPath).get();
      await Promise.all(audits.docs.map(doc => doc.ref.update({
        deleted_at: FieldValue.serverTimestamp(),
        deletion_status: "deleted",
      })));
      familyPhoto = undefined;
    }

    const book = await storyTextPromise;
    const characterPath = `story-media/${user.uid}/${storyId}/character-reference.png`;
    await storageBucket().file(characterPath).save(characterReference, {
      resumable: false,
      contentType: "image/png",
      metadata: { cacheControl: "private,max-age=3600", metadata: { ownerId: user.uid, storyId } },
    });

    const pageRecords = [];
    for (let index = 0; index < book.pages.length; index += 3) {
      const group = book.pages.slice(index, index + 3);
      const images = await Promise.all(group.map((page, offset) =>
        generatePageIllustration(characterReference, page.title, page.sceneDescription, index + offset + 1),
      ));
      for (let offset = 0; offset < group.length; offset += 1) {
        const pageNumber = index + offset + 1;
        const path = `story-media/${user.uid}/${storyId}/page-${pageNumber}.png`;
        await storageBucket().file(path).save(images[offset], {
          resumable: false,
          contentType: "image/png",
          metadata: { cacheControl: "private,max-age=3600", metadata: { ownerId: user.uid, storyId } },
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

    const batch = db.batch();
    for (const page of pageRecords) {
      batch.set(storyRef.collection("pages").doc(String(page.page_number).padStart(2, "0")), page);
    }
    batch.update(storyRef, {
      title: book.title,
      dedication: book.dedication,
      cover_path: pageRecords[0]?.illustration_path || null,
      status: "ready",
      updated_at: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return NextResponse.json({ storyId });
  } catch (error) {
    if (brief?.photoPath) {
      await storageBucket().file(brief.photoPath).delete({ ignoreNotFound: true }).catch(() => undefined);
    }
    if (storyId) {
      await firestore().collection("stories").doc(storyId).set({
        status: "failed",
        error_code: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN",
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const message = error instanceof Error && error.message === "STORY_INPUT_BLOCKED"
      ? "Please revise these details for a child-safe story."
      : "Story generation did not finish. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
