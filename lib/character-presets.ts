import type { CharacterPresetId, CharacterPresetRole, StoryBrief } from "@/lib/types";

export type CharacterPreset = {
  id: CharacterPresetId;
  role: CharacterPresetRole;
  label: string;
  ageBand?: "toddler" | "preschool" | "early_school" | "adult";
  description: string;
  palette: string;
};

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: "asian-daughter-toddler-cozy",
    role: "daughter",
    label: "Daughter · toddler",
    ageBand: "toddler",
    description: "Asian toddler daughter, soft round cheeks, short bob or tiny tied hair, cozy pajamas, curious gentle expression.",
    palette: "raspberry coral, cream, soft marigold",
  },
  {
    id: "asian-daughter-preschool-birthday",
    role: "daughter",
    label: "Daughter · birthday",
    ageBand: "preschool",
    description: "Asian preschool daughter, expressive bright eyes, shoulder-length hair, playful birthday outfit, sweet confident smile.",
    palette: "sky blue, raspberry coral, parchment white",
  },
  {
    id: "asian-son-toddler-cozy",
    role: "son",
    label: "Son · toddler",
    ageBand: "toddler",
    description: "Asian toddler son, soft rounded face, neat short hair, cozy bedtime clothes, lively curious posture.",
    palette: "midnight navy, sky blue, cream",
  },
  {
    id: "asian-son-preschool-adventure",
    role: "son",
    label: "Son · adventure",
    ageBand: "preschool",
    description: "Asian preschool son, warm grin, tidy side-swept hair, casual storybook outfit, playful explorer energy.",
    palette: "leaf green, marigold, sky blue",
  },
  {
    id: "asian-mom-warm-cardigan",
    role: "mom",
    label: "Mom · warm cardigan",
    ageBand: "adult",
    description: "Asian mother, kind expressive eyes, natural shoulder-length hair, soft cardigan, calm bedtime warmth.",
    palette: "cream, leaf green, raspberry coral",
  },
  {
    id: "asian-dad-cozy-sweater",
    role: "dad",
    label: "Dad · cozy sweater",
    ageBand: "adult",
    description: "Asian father, gentle smile, neat short hair, cozy sweater, protective and playful family presence.",
    palette: "midnight navy, marigold, parchment white",
  },
  {
    id: "asian-sibling-playful",
    role: "sibling",
    label: "Sibling · playful",
    ageBand: "early_school",
    description: "Asian sibling, slightly older child, bright friendly expression, casual outfit, caring playful energy.",
    palette: "sky blue, leaf green, cream",
  },
];

export const CHARACTER_STYLE_VARIANTS = [
  { id: "cozy-bedtime", label: "Cozy bedtime", description: "soft pajamas, warm lamplight feeling, gentle bedtime palette" },
  { id: "birthday", label: "Birthday", description: "subtle celebration outfit, cheerful color accents, no readable text" },
  { id: "school-day", label: "School day", description: "neat everyday clothes, small backpack-like accessory only when appropriate" },
  { id: "family-outing", label: "Family outing", description: "comfortable outdoor layers, sunny family snapshot feeling" },
] as const;

export function selectedPresets(brief: Pick<StoryBrief, "selectedCharacterPresetIds">) {
  const selected = new Set(brief.selectedCharacterPresetIds || []);
  return CHARACTER_PRESETS.filter(preset => selected.has(preset.id));
}

export function presetPromptSummary(brief: Pick<StoryBrief, "selectedCharacterPresetIds" | "characterStyleVariant">) {
  const presets = selectedPresets(brief);
  const style = CHARACTER_STYLE_VARIANTS.find(variant => variant.id === brief.characterStyleVariant);
  const presetText = presets.length
    ? presets.map(preset => `${preset.label}: ${preset.description}; palette ${preset.palette}.`).join("\n")
    : "No preset selected; infer a gentle illustrated family character design from the story brief.";
  return `${presetText}
Style variant: ${style ? `${style.label} - ${style.description}` : "premium cohesive StoryGlow family look"}.`;
}
