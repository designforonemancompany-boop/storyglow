import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { firestore } from "@/lib/firebase/admin";
import type { StoryPageRecord, StoryRecord } from "@/lib/types";

function iso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : new Date(0).toISOString();
}

export function storyFromDoc(doc: QueryDocumentSnapshot<DocumentData> | FirebaseFirestore.DocumentSnapshot<DocumentData>): StoryRecord {
  const data = doc.data() || {};
  return {
    id: doc.id,
    owner_id: data.owner_id,
    title: data.title || "Creating your story...",
    dedication: data.dedication || "",
    status: data.status || "generating",
    brief: data.brief,
    cover_path: data.cover_path || null,
    created_at: iso(data.created_at),
    updated_at: iso(data.updated_at),
  };
}

export async function ownedStory(userId: string, storyId: string) {
  const doc = await firestore().collection("stories").doc(storyId).get();
  if (!doc.exists || doc.data()?.owner_id !== userId) return null;
  return storyFromDoc(doc);
}

export async function storyPages(storyId: string) {
  const snapshot = await firestore().collection("stories").doc(storyId)
    .collection("pages").orderBy("page_number", "asc").get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StoryPageRecord[];
}
