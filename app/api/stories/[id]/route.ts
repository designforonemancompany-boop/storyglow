import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ownedStory } from "@/lib/firestore-data";
import { firestore, storageBucket } from "@/lib/firebase/admin";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireApiUser();
    if (!await ownedStory(user.uid, id)) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    const db = firestore();
    const storyRef = db.collection("stories").doc(id);
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
