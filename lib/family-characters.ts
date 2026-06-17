import { FieldValue } from "firebase-admin/firestore";
import { presetPromptSummary, selectedPresets } from "@/lib/character-presets";
import { firestore } from "@/lib/firebase/admin";
import type { FamilyCharacterRecord, StoryBrief } from "@/lib/types";

const STYLE_PALETTE = "parchment white, midnight navy, sky blue, marigold, raspberry coral, leaf green";

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function iso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : new Date(0).toISOString();
}

export function buildTraitBible(brief: StoryBrief, source: FamilyCharacterRecord["source"]) {
  const roleSummary = (brief.familyRoles || [])
    .map(role => `Person ${role.marker}: ${role.role.replace("_", " ")}${role.displayName ? ` named ${role.displayName}` : ""}`)
    .join("; ");

  const presets = selectedPresets(brief);
  return {
    childAppearance: `${brief.childName}, age ${brief.age}. Traits to preserve: ${brief.characterTraits || "warm, curious, bedtime-friendly child"}.`,
    parentGuardianTraits: brief.grownUps || "Loving parent or guardian figures, gentle and emotionally present.",
    siblingTraits: roleSummary.includes("sibling") ? roleSummary : "No sibling traits supplied yet.",
    clothingAccessoryRules: "Keep adult accessories with the correct adult. The child may carry story-specific playful items only when the story asks for them.",
    stylePalette: STYLE_PALETTE,
    presetSummary: presets.length ? presetPromptSummary(brief) : undefined,
    reusablePromptNotes: source === "role_labeled_photo"
      ? "Derived from a role-labeled private photo. Never reuse or expose the raw photo; reuse only this illustrated reference and structured traits."
      : presets.length
        ? "Derived from parent-selected preset family characters and the story brief. Reuse the generated character sheet, selected presets, silhouette, outfit logic, and family palette in future books."
      : "Derived from the story brief as a generated character bible. Keep the same silhouette, age, palette, and family roles in future books.",
  };
}

export function familyCharacterFromDoc(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): FamilyCharacterRecord {
  const data = doc.data() || {};
  return {
    id: doc.id,
    owner_id: data.owner_id,
    child_name: data.child_name,
    status: data.status || "active",
    source: data.source || "generated_bible",
    reference_path: data.reference_path,
    reference_assets: data.reference_assets || [],
    selected_preset_ids: data.selected_preset_ids || [],
    character_style_variant: data.character_style_variant || null,
    trait_bible: data.trait_bible,
    created_at: iso(data.created_at),
    updated_at: iso(data.updated_at),
    last_used_at: iso(data.last_used_at),
  };
}

export async function findReusableFamilyCharacter(userId: string, brief: StoryBrief) {
  const childKey = normalizeName(brief.childName);
  const snapshot = await firestore().collection("familyCharacters")
    .where("owner_id", "==", userId)
    .limit(50)
    .get();
  const doc = snapshot.docs
    .filter(doc => doc.data().child_key === childKey && doc.data().status === "active")
    .sort((a, b) => {
      const aDate = a.data().last_used_at?.toMillis?.() || 0;
      const bDate = b.data().last_used_at?.toMillis?.() || 0;
      return bDate - aDate;
    })[0];
  return doc ? familyCharacterFromDoc(doc) : null;
}

export async function saveFamilyCharacter({
  userId,
  brief,
  storyId,
  referencePath,
  source,
  characterId,
}: {
  userId: string;
  brief: StoryBrief;
  storyId: string;
  referencePath: string;
  source: FamilyCharacterRecord["source"];
  characterId?: string;
}) {
  const ref = characterId
    ? firestore().collection("familyCharacters").doc(characterId)
    : firestore().collection("familyCharacters").doc();
  await ref.set({
    owner_id: userId,
    child_name: brief.childName,
    child_key: normalizeName(brief.childName),
    status: "active",
    source,
    reference_path: referencePath,
    reference_assets: [
      {
        role: "family_sheet",
        label: source === "role_labeled_photo" ? "Role-labeled family character sheet" : "Preset family character sheet",
        path: referencePath,
      },
      ...(brief.familyRoles || []).map(role => ({
        role: role.role,
        label: role.displayName || role.role.replace("_", " "),
        path: referencePath,
      })),
      ...selectedPresets(brief).map(preset => ({
        role: preset.role === "sibling" ? "sibling" : preset.role === "daughter" || preset.role === "son" ? "main_character" : "parent_guardian",
        label: preset.label,
        path: referencePath,
        presetId: preset.id,
      })),
    ],
    selected_preset_ids: brief.selectedCharacterPresetIds || [],
    character_style_variant: brief.characterStyleVariant || null,
    source_story_id: storyId,
    trait_bible: buildTraitBible(brief, source),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    last_used_at: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function markFamilyCharacterUsed(characterId: string) {
  await firestore().collection("familyCharacters").doc(characterId).set({
    last_used_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
}
