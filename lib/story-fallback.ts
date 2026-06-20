import { z } from "zod";
import type { StoryBrief } from "./types";

const FallbackStorySchema = z.object({
  title: z.string().min(3).max(90),
  dedication: z.string().min(10).max(220),
  pages: z.array(z.object({
    title: z.string().min(2).max(70),
    text: z.string().min(40).max(520),
    sceneDescription: z.string().min(20).max(500),
    storyBeat: z.string().min(8).max(140).optional(),
    audioScenePlan: z.string().min(8).max(500).optional(),
    ambienceKey: z.enum(["bedroom_glow", "birthday_sparkle", "gentle_adventure", "family_laughter", "quiet_wonder", "sleepy_landing"]).optional(),
    effectCues: z.array(z.string()).max(4).optional(),
    characterVoiceHints: z.array(z.string()).max(4).optional(),
  })).length(10),
});

export type FallbackStoryBook = z.infer<typeof FallbackStorySchema>;

function pronouns(gender: StoryBrief["gender"]) {
  if (gender === "boy") return { subject: "he", object: "him", possessive: "his" };
  if (gender === "girl") return { subject: "she", object: "her", possessive: "her" };
  return { subject: "they", object: "them", possessive: "their" };
}

function sentence(value: string, fallback: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return fallback;
  return trimmed.endsWith(".") || trimmed.endsWith("!") || trimmed.endsWith("?") ? trimmed : `${trimmed}.`;
}

function limitText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const shortened = value.slice(0, Math.max(0, maxLength - 3)).replace(/\s+\S*$/, "");
  return `${shortened || value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function capitalizeOpening(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  const index = cleaned.search(/[A-Za-z]/);
  if (index < 0) return cleaned;
  return `${cleaned.slice(0, index)}${cleaned.charAt(index).toUpperCase()}${cleaned.slice(index + 1)}`;
}

const ambienceCycle = ["bedroom_glow", "gentle_adventure", "birthday_sparkle", "quiet_wonder", "family_laughter", "sleepy_landing"] as const;

function normalizeFallbackStoryBook(book: FallbackStoryBook) {
  return {
    ...book,
    title: capitalizeOpening(book.title),
    dedication: capitalizeOpening(book.dedication),
    pages: book.pages.map((page, index) => ({
      ...page,
      title: capitalizeOpening(page.title),
      text: capitalizeOpening(page.text),
      sceneDescription: capitalizeOpening(page.sceneDescription),
      storyBeat: page.storyBeat || `Beat ${index + 1}: a clear, emotionally warm 5-minute bedtime story moment.`,
      audioScenePlan: page.audioScenePlan || "Warm narrator with gentle pacing, subtle ambience, soft transition effect, and no startling sounds.",
      ambienceKey: page.ambienceKey || ambienceCycle[Math.min(index, ambienceCycle.length - 1)],
      effectCues: page.effectCues || ["soft chime", "page whoosh"],
      characterVoiceHints: page.characterVoiceHints || ["Narrator warm and close", "Family voices gentle and bedtime-safe"],
    })),
  };
}

export function fallbackStoryText(brief: StoryBrief): FallbackStoryBook {
  const p = pronouns(brief.gender);
  const grownUps = limitText(brief.grownUps.trim() || "the people who loved them most", 90);
  const traits = sentence(limitText(brief.characterTraits, 120), "gentle, curious, and full of small bright surprises.");
  const event = sentence(limitText(brief.event, 150), "A small family moment became a memory worth keeping.");
  const memory = sentence(limitText(brief.memory, 150), "There was one tiny detail everyone wanted to remember forever.");
  const child = limitText(brief.childName.trim() || "Your child", 40);
  const agePhrase = `${brief.age}-year-old`;

  return normalizeFallbackStoryBook(FallbackStorySchema.parse({
    title: `${child}'s Little Glow`,
    dedication: limitText(`For ${child}, whose everyday moments already feel like keepsakes to ${grownUps}.`, 220),
    pages: [
      {
        title: "Morning Spark",
        text: `${child} woke as the ${agePhrase} star of a very ordinary day that did not feel ordinary at all. ${grownUps} noticed the little stretch, the sleepy smile, and the way ${p.possessive} whole face seemed to say, I am growing.`,
        sceneDescription: `Cozy morning bedroom scene with ${child}, age ${brief.age}, waking happily while ${grownUps} watch with tender pride.`,
      },
      {
        title: "A Tiny Plan",
        text: `${traits} That was one reason every room felt more interesting when ${child} arrived. A cushion became a mountain, a hallway became a parade, and the day began to gather itself around ${p.object}.`,
        sceneDescription: `${child} exploring a warm family room with playful confidence, soft toys and cozy home details around them.`,
      },
      {
        title: "The Big Moment",
        text: `${event} ${child} did not know that grown-up hearts could grow so full from watching one small person try, smile, wobble, and try again. But ${grownUps} knew. They saw every brave little bit.`,
        sceneDescription: `The family event as a warm storybook scene, centered on ${child}, with parents nearby and a celebratory but calm mood.`,
      },
      {
        title: "The Special Detail",
        text: `${memory} It was the kind of detail that might look small to the world, but inside the family it shone like a little lantern. Everyone smiled because it was completely, wonderfully ${child}.`,
        sceneDescription: `Close family scene highlighting the memorable object or action from the parent's memory, with ${child} proud and delighted.`,
      },
      {
        title: "Growing Up",
        text: `${grownUps} remembered when ${child} was smaller, when fingers curled tightly and words came out like music only the family understood. Now ${p.subject} had new ideas, new expressions, and new ways to say, Look at me.`,
        sceneDescription: `Tender visual contrast of baby memories and present-day ${child}, shown as soft picture-book memory shapes around the family.`,
      },
      {
        title: "Held Close",
        text: `Even when ${child} wanted to do things independently, love stayed close by. It waited in open arms, in patient voices, in the quiet help that made big feelings feel smaller and safe again.`,
        sceneDescription: `${child} near a parent or guardian in a warm home setting, feeling supported while still independent.`,
      },
      {
        title: "A Family Smile",
        text: `The best part of the day was not that everything was perfect. The best part was that it belonged to them. The giggles, the pauses, the funny little detail, and the proud faces all became one family smile.`,
        sceneDescription: `Family group smiling together in a cozy premium watercolor scene, with ${child} as the clear focal point.`,
      },
      {
        title: "Soft Evening",
        text: `When evening came, the busy colors of the day softened. ${child} carried the memory with ${p.object}, not in a pocket, but somewhere warmer: in the safe place where loved stories settle before sleep.`,
        sceneDescription: `Evening scene with warm lamplight, ${child} winding down while the family memory glows subtly around them.`,
      },
      {
        title: "One More Look",
        text: `${grownUps} looked at ${child} and saw the baby ${p.subject} had been, the child ${p.subject} was now, and the wonderful person still unfolding. Their hearts whispered the same thing at once: we are so lucky to watch you grow.`,
        sceneDescription: `Parents watching ${child} with loving pride, bedtime colors, soft paper texture, emotional but peaceful composition.`,
      },
      {
        title: "Goodnight Glow",
        text: `At bedtime, ${child} was tucked into quiet and kindness. The day rested too. And in the gentle dark, the family story kept glowing: a little brighter, a little deeper, and ready to be remembered again tomorrow.`,
        sceneDescription: `Peaceful bedtime ending with ${child} safe and cozy, family nearby, soft moonlight and warm premium storybook atmosphere.`,
      },
    ],
  }));
}
