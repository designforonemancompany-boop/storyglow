import { FieldValue } from "firebase-admin/firestore";
import { after, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ownedStory, storyPages } from "@/lib/firestore-data";
import { firestore, storageBucket } from "@/lib/firebase/admin";
import { generatePageIllustration, generateStandalonePageIllustration } from "@/lib/google-ai";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function retryMissingIllustrations({
  storyId,
  userId,
}: {
  storyId: string;
  userId: string;
}) {
  const story = await ownedStory(userId, storyId);
  if (!story) return;
  const pages = await storyPages(storyId);
  const missingPages = pages.filter(page => !page.illustration_path);
  if (!missingPages.length) {
    await firestore().collection("stories").doc(storyId).set({
      media_generation_status: "ready",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
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
        ? await generatePageIllustration(characterReference, page.title, page.scene_description || page.body, page.page_number)
        : await generateStandalonePageIllustration(story.brief, page.title, page.scene_description || page.body, page.page_number, story.visual_style_lock);
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
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const story = await ownedStory(user.uid, id);
    if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });
    if (!["ready", "archived"].includes(story.status)) {
      return NextResponse.json({ error: "Story is not ready for illustration retry yet." }, { status: 409 });
    }

    const pages = await storyPages(id);
    const missingPages = pages.filter(page => !page.illustration_path);
    if (!missingPages.length) {
      return NextResponse.json({ retryStarted: false, missingPages: 0 });
    }

    await firestore().collection("stories").doc(id).set({
      media_generation_status: "generating",
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    after(() => retryMissingIllustrations({ storyId: id, userId: user.uid }));
    return NextResponse.json({ retryStarted: true, missingPages: missingPages.length }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    return NextResponse.json({ error: "Could not retry page illustrations." }, { status: 500 });
  }
}
