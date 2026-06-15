import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { ownedStory } from "@/lib/firestore-data";
import { firestore, storageBucket } from "@/lib/firebase/admin";

const UpdateStorySchema = z.object({ archived: z.boolean() });

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
