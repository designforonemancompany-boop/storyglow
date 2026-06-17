import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { ownedStory, storyPages } from "@/lib/firestore-data";
import { firestore, storageBucket } from "@/lib/firebase/admin";
import { generatePageIllustration, generateStandalonePageIllustration } from "@/lib/google-ai";

const UpdateStorySchema = z.object({ archived: z.boolean() });
const StoryActionSchema = z.object({ action: z.literal("retry_illustrations") });

async function retryMissingIllustrations(storyId: string, userId: string) {
  const story = await ownedStory(userId, storyId);
  if (!story) throw new Error("STORY_NOT_FOUND");
  const pages = await storyPages(storyId);
  const missingPages = pages.filter(page => !page.illustration_path);
  if (!missingPages.length) {
    await firestore().collection("stories").doc(storyId).set({
      media_generation_status: "ready",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { missingPages: 0, retryFlags: [] as string[] };
  }

  let characterReference: Buffer | null = null;
  if (story.character_reference_path) {
    characterReference = await storageBucket().file(story.character_reference_path).download()
      .then(([bytes]) => bytes)
      .catch(() => null);
  }

  const storyRef = firestore().collection("stories").doc(storyId);
  const retryFlags: string[] = [];
  for (const page of missingPages) {
    try {
      const bytes = characterReference
        ? await generatePageIllustration(characterReference, page.title, page.body, page.page_number)
        : await generateStandalonePageIllustration(story.brief, page.title, page.body, page.page_number);
      const path = `story-media/${userId}/${storyId}/page-${page.page_number}.png`;
      await storageBucket().file(path).save(bytes, {
        resumable: false,
        contentType: "image/png",
        metadata: { cacheControl: "private,max-age=3600", metadata: { ownerId: userId, storyId, retry: "true" } },
      });
      await storyRef.collection("pages").doc(String(page.page_number).padStart(2, "0")).set({
        illustration_path: path,
      }, { merge: true });
    } catch (error) {
      retryFlags.push(`page_${page.page_number}_illustration_retry_needed`);
      console.warn("Page illustration retry failed", {
        storyId,
        userId,
        pageNumber: page.page_number,
        message: error instanceof Error ? error.message : "UNKNOWN",
      });
    }
  }

  await Promise.all([
    storyRef.set({
      media_generation_status: retryFlags.length ? "needs_retry" : "ready",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true }),
    firestore().collection("generationReviews").doc(storyId).set({
      flags: retryFlags,
      status: retryFlags.length ? "needs_manual_review" : "passed",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true }),
  ]);

  return { missingPages: missingPages.length, retryFlags };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireApiUser();
    const parsed = StoryActionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid story action." }, { status: 400 });
    const story = await ownedStory(user.uid, id);
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    if (!["ready", "archived"].includes(story.status)) {
      return NextResponse.json({ error: "Story is not ready for illustration retry yet." }, { status: 409 });
    }

    await firestore().collection("stories").doc(id).set({
      media_generation_status: "generating",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    const result = await retryMissingIllustrations(id, user.uid);
    return NextResponse.json({
      retryStarted: true,
      missingPages: result.missingPages,
      retryFlags: result.retryFlags,
    });
  } catch (error) {
    const status = error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500;
    return NextResponse.json({
      error: status === 401 ? "Sign in required" : "Could not retry page illustrations.",
    }, { status });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireApiUser();
    const parsed = UpdateStorySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid story update" }, { status: 400 });

    const story = await ownedStory(user.uid, id);
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    if (!parsed.data.archived && story.status !== "archived") {
      return NextResponse.json({ error: "Story is not archived" }, { status: 409 });
    }
    if (parsed.data.archived && story.status !== "ready") {
      return NextResponse.json({ error: "Only completed stories can be archived" }, { status: 409 });
    }

    await firestore().collection("stories").doc(id).update({
      status: parsed.data.archived ? "archived" : "ready",
      archived_at: parsed.data.archived ? FieldValue.serverTimestamp() : null,
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ archived: parsed.data.archived });
  } catch (error) {
    const status = error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Sign in required" : "Could not update story" }, { status });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireApiUser();
    if (!await ownedStory(user.uid, id)) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    const db = firestore();
    const storyRef = db.collection("stories").doc(id);
    const orders = await db.collection("printOrders").where("story_id", "==", id).get();
    const protectedOrder = orders.docs.some(doc =>
      ["paid", "in_production", "shipped"].includes(doc.data().fulfillment_status),
    );
    if (protectedOrder) {
      return NextResponse.json({
        error: "This story has an active physical-book order and cannot be deleted yet.",
      }, { status: 409 });
    }
    const pages = await storyRef.collection("pages").get();
    const links = await db.collection("shareLinks").where("story_id", "==", id).get();
    const progress = db.collection("profiles").doc(user.uid).collection("progress").doc(id);
    const batch = db.batch();
    pages.docs.forEach(doc => batch.delete(doc.ref));
    links.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(progress);
    batch.delete(storyRef);
    await batch.commit();
    const [files] = await storageBucket().getFiles({ prefix: `story-media/${user.uid}/${id}/` });
    await Promise.all(files.map(file => file.delete({ ignoreNotFound: true })));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const status = error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Sign in required" : "Could not delete story" }, { status });
  }
}
