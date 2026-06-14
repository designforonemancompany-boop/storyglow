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
};

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
  illustration_path: string | null;
  narration_path: string | null;
  narration_duration_ms: number | null;
};
