export type StoryEntitlement = "free" | "credit";

type EntitlementInput = {
  freeStoriesUsed?: number;
  storybookCredits?: number;
  hasExistingStory: boolean;
};

export function selectStoryEntitlement({
  freeStoriesUsed,
  storybookCredits = 0,
  hasExistingStory,
}: EntitlementInput): StoryEntitlement | null {
  const normalizedFreeUse = freeStoriesUsed ?? (hasExistingStory ? 1 : 0);
  if (normalizedFreeUse < 1) return "free";
  if (storybookCredits > 0) return "credit";
  return null;
}

