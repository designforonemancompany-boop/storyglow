import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { firestore } from "@/lib/firebase/admin";
import type { FamilyCharacterRecord, StoryPageRecord, StoryRecord } from "@/lib/types";
import { familyCharacterFromDoc } from "@/lib/family-characters";

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
    cover_prompt_version: data.cover_prompt_version || null,
    media_generation_status: data.media_generation_status || null,
    family_character_id: data.family_character_id || null,
    character_reference_path: data.character_reference_path || null,
    snapshot_id: data.snapshot_id || null,
    cover_choice_status: data.cover_choice_status || null,
    selected_cover_option_id: data.selected_cover_option_id || null,
    visual_style_lock: data.visual_style_lock || null,
    error_code: data.error_code || null,
    error_stage: data.error_stage || null,
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

export async function ownedFamilyCharacters(userId: string): Promise<FamilyCharacterRecord[]> {
  const snapshot = await firestore().collection("familyCharacters")
    .where("owner_id", "==", userId)
    .where("status", "==", "active")
    .get();
  return snapshot.docs.map(familyCharacterFromDoc)
    .sort((a, b) => b.last_used_at.localeCompare(a.last_used_at));
}
