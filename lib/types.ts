export type StoryBrief = {
  childName: string;
  age: number;
  gender: "girl" | "boy" | "self";
  grownUps: string;
  event: string;
  memory: string;
  characterTraits: string;
  photoPath?: string;
  familyRoles?: FamilyRole[];
  selectedCharacterPresetIds?: CharacterPresetId[];
  characterStyleVariant?: CharacterStyleVariantId;
};

export type CharacterPresetRole = "daughter" | "son" | "mom" | "dad" | "sibling";

export type CharacterPresetId =
  | "asian-daughter-toddler-cozy"
  | "asian-daughter-preschool-birthday"
  | "asian-son-toddler-cozy"
  | "asian-son-preschool-adventure"
  | "asian-mom-warm-cardigan"
  | "asian-dad-cozy-sweater"
  | "asian-sibling-playful";

export type CharacterStyleVariantId = "cozy-bedtime" | "birthday" | "school-day" | "family-outing";

export type FamilyRole = {
  marker: number;
  role: "main_character" | "parent_guardian" | "sibling";
  displayName?: string;
};

export type StoryPage = {
  title: string;
  text: string;
  illustrationPath: string | null;
  narrationPath: string | null;
  narrationDurationMs: number | null;
};

export type StoryRecord = {
  id: string;
  owner_id: string;
  title: string;
  dedication: string;
  status: "generating" | "ready" | "failed" | "archived";
  brief: StoryBrief;
  cover_path: string | null;
  cover_prompt_version?: string | null;
  media_generation_status?: "generating" | "awaiting_cover_choice" | "ready" | "needs_retry" | null;
  family_character_id?: string | null;
  character_reference_path?: string | null;
  snapshot_id?: string | null;
  cover_choice_status?: "not_started" | "generating" | "ready" | "selected" | "needs_retry" | null;
  selected_cover_option_id?: string | null;
  visual_style_lock?: string | null;
  error_code?: string | null;
  error_stage?: string | null;
  created_at: string;
  updated_at: string;
  story_pages?: StoryPageRecord[];
};

export type StoryPageRecord = {
  id: string;
  story_id: string;
  page_number: number;
  title: string;
  body: string;
  scene_description?: string | null;
  story_beat?: string | null;
  audio_scene_plan?: string | null;
  ambience_key?: "bedroom_glow" | "birthday_sparkle" | "gentle_adventure" | "family_laughter" | "quiet_wonder" | "sleepy_landing" | null;
  effect_cues?: string[];
  character_voice_hints?: string[];
  illustration_path: string | null;
  narration_path: string | null;
  narration_duration_ms: number | null;
};

export type PrintOrderRecord = {
  id: string;
  owner_id: string;
  story_id: string;
  checkout_session_id: string;
  payment_status: string;
  fulfillment_status: "paid" | "in_production" | "shipped" | "completed" | "cancelled";
  amount_total: number | null;
  currency: string | null;
  updated_at: unknown;
};

export type FamilyCharacterRecord = {
  id: string;
  owner_id: string;
  child_name: string;
  status: "active" | "archived" | "draft_failed";
  source: "generated_bible" | "role_labeled_photo" | "reused_reference";
  reference_path: string;
  reference_assets?: Array<{
    role: "main_character" | "parent_guardian" | "sibling" | "family_sheet";
    label: string;
    path: string;
    presetId?: CharacterPresetId;
  }>;
  selected_preset_ids?: CharacterPresetId[];
  character_style_variant?: CharacterStyleVariantId | null;
  trait_bible: {
    childAppearance: string;
    parentGuardianTraits: string;
    siblingTraits: string;
    clothingAccessoryRules: string;
    stylePalette: string;
    reusablePromptNotes: string;
    presetSummary?: string;
    parentRefinementNotes?: string;
  };
  created_at: string;
  updated_at: string;
  last_used_at: string;
};

export type StorySnapshotRecord = {
  id: string;
  owner_id: string;
  story_id: string;
  family_character_id: string | null;
  child_name: string;
  age: number;
  event: string;
  memory: string;
  cover_path: string | null;
  title: string;
  created_at: string;
};

export type GenerationReviewRecord = {
  id: string;
  owner_id: string;
  story_id: string;
  family_character_id: string | null;
  status: "passed" | "needs_manual_review";
  flags: string[];
  checklist: {
    characterDrift: "passed" | "review";
    adultTraitsOnChild: "passed" | "review";
    missingCoreCharacter: "passed" | "review";
    styleMismatch: "passed" | "review";
  };
  notes: string;
  created_at: string;
};

export type CoverOptionRecord = {
  id: string;
  owner_id: string;
  story_id: string;
  option_id: string;
  style_label: string;
  prompt_summary: string;
  visual_style_lock: string;
  image_path: string | null;
  selected: boolean;
  status: "ready" | "failed";
  created_at: string;
  updated_at: string;
};