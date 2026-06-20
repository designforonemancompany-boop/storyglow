import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { fallbackStoryText } from "@/lib/story-fallback";
import { normalizeStoryBook } from "@/lib/story-text-normalization";
import type { FamilyRole, StoryBrief } from "@/lib/types";

const StorySchema = z.object({
  title: z.string().min(3).max(90),
  dedication: z.string().min(10).max(220),
  pages: z.array(z.object({
    title: z.string().min(2).max(70),
    text: z.string().min(40).max(520),
    sceneDescription: z.string().min(20).max(500),
    storyBeat: z.string().min(8).max(140).optional(),
    audioScenePlan: z.string().min(8).max(500).optional(),
    ambienceKey: z.enum(["bedroom_glow", "birthday_sparkle", "gentle_adventure", "family_laughter", "quiet_wonder", "sleepy_landing"]).optional(),
    effectCues: z.array(z.string().min(2).max(60)).max(4).optional(),
    characterVoiceHints: z.array(z.string().min(2).max(90)).max(4).optional(),
  })).min(10).max(12),
});

const STORY_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    dedication: { type: "string" },
    pages: {
      type: "array",
      minItems: 10,
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          text: { type: "string" },
          sceneDescription: { type: "string" },
          storyBeat: { type: "string" },
          audioScenePlan: { type: "string" },
          ambienceKey: { type: "string", enum: ["bedroom_glow", "birthday_sparkle", "gentle_adventure", "family_laughter", "quiet_wonder", "sleepy_landing"] },
          effectCues: { type: "array", items: { type: "string" } },
          characterVoiceHints: { type: "array", items: { type: "string" } },
        },
        required: ["title", "text", "sceneDescription", "storyBeat", "audioScenePlan", "ambienceKey", "effectCues", "characterVoiceHints"],
      },
    },
  },
  required: ["title", "dedication", "pages"],
};

export const STYLE_MODIFIER = `
Warm, whimsical, premium custom children's-book illustration. Never photorealistic.
Use a high-end animated family-film storybook look: rounded expressive character
design, cinematic soft lighting, tactile painterly surfaces, gentle depth, polished
composition, big readable emotions, and a cohesive palette of parchment white,
midnight navy, sky blue, marigold, raspberry coral, and leaf green. Preserve exact
illustrated character identity, skin tone, hair, age, facial proportions, clothing
motifs, and family relationships.
Adult-only features such as facial hair, glasses, handbags, or accessories must stay
with the correctly labeled adult and must never migrate onto the child unless the brief
explicitly says the child is wearing that same item in the scene. Show only one
instance of the main child in each scene unless the prompt explicitly asks for a
memory montage. Non-negotiable anatomy quality: natural child proportions for the
stated age, correctly sized head and body, symmetrical face, clean eyes, normal hands
with five fingers when visible, correctly jointed arms and legs, grounded feet, no
warped limbs, twisted necks, stretched torsos, broken perspective, melted features,
or distorted facial proportions. No duplicate clones, time-lapse copies, extra
siblings, or repeated versions of the same character. No logos, readable words,
captions, labels, signs, book-page text, watermark, uncanny realism, or generic
stock-art faces.
`;

export const COVER_STYLE_OPTIONS = [
  {
    id: "storybook-watercolor",
    label: "Soft Watercolor Wonder",
    promptSummary: "Gentle watercolor overlays, soft paper grain, warm bedtime glow, delicate premium personalized-book composition.",
  },
  {
    id: "cinematic-adventure",
    label: "Cinematic Little Adventure",
    promptSummary: "Bolder animated family-film lighting, deeper sky-and-gold palette, playful camera angle, strong emotional thumbnail readability.",
  },
  {
    id: "cozy-heirloom",
    label: "Cozy Heirloom Classic",
    promptSummary: "Classic picture-book charm, textured gouache, nostalgic family keepsake mood, calm elegant composition for bedtime.",
  },
] as const;

export type CoverStyleOption = typeof COVER_STYLE_OPTIONS[number];

function roleLock(brief: StoryBrief) {
  if (!brief.familyRoles?.length) return "Family roles come from the grown-up names and story brief only; keep relationships consistent and avoid adding extra people.";
  return brief.familyRoles.map(role =>
    `Person ${role.marker} is ${role.role.replace("_", " ")}${role.displayName ? ` named ${role.displayName}` : ""}`,
  ).join(". ");
}

export function buildVisualStyleLock(brief: StoryBrief, option: CoverStyleOption) {
  return `Chosen cover direction: ${option.label}. ${option.promptSummary}
Main child identity lock: ${brief.childName}, age ${brief.age}, ${brief.gender}, with these parent-supplied traits: ${brief.characterTraits || "warm, curious, expressive, bedtime-friendly"}.
Family lock: ${brief.grownUps || "loving grown-ups"}. ${roleLock(brief)}
Story memory lock: ${brief.event}. Memorable detail: ${brief.memory}.
Consistency rules: keep the same child age, face shape, hair, outfit color family, family roles, palette, and emotional tone across cover and every interior page. Maintain correct anatomy and natural age-appropriate proportions with no distorted faces, hands, limbs, or perspective. Adult accessories must stay with adults unless the scene explicitly says the child is carrying or wearing the item. Use one clear moment per image and exactly one instance of the main child.`;
}

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

async function generateContent(model: string, payload: object) {
  const { GOOGLE_GENERATIVE_AI_API_KEY } = serverEnv();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GOOGLE_GENERATIVE_AI_API_KEY)}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(240_000),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) as GeminiResponse : {};
      if (result.promptFeedback?.blockReason) throw new Error("STORY_INPUT_BLOCKED");
      if (!response.ok || result.error) {
        const message = result.error?.message || `GEMINI_HTTP_${response.status}`;
        const transient = [408, 429, 500, 502, 503, 504].includes(response.status);
        if (transient && attempt < 3) {
          lastError = new Error(message);
          await new Promise(resolve => setTimeout(resolve, attempt * 1200));
          continue;
        }
        throw new Error(message);
      }
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "STORY_INPUT_BLOCKED") throw error;
      lastError = error;
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1200));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("GEMINI_REQUEST_FAILED");
}

function textFrom(result: GeminiResponse) {
  const candidate = result.candidates?.[0];
  const text = candidate?.content?.parts?.map(part => part.text || "").join("").trim() || "";
  if (!text) {
    const reason = candidate?.finishReason || result.promptFeedback?.blockReason || "EMPTY_TEXT";
    throw new Error(`GEMINI_TEXT_EMPTY_${reason}`);
  }
  return text;
}

function mediaFrom(result: GeminiResponse) {
  const media = result.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData;
  if (!media?.data) throw new Error("GEMINI_MEDIA_EMPTY");
  return {
    bytes: Buffer.from(media.data, "base64"),
    mimeType: media.mimeType || "application/octet-stream",
  };
}

const safetySettings = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map(category => ({ category, threshold: "BLOCK_MEDIUM_AND_ABOVE" }));

export async function moderateStoryBrief(brief: StoryBrief) {
  try {
    const result = await generateContent(serverEnv().GEMINI_TEXT_MODEL, {
      systemInstruction: {
        parts: [{ text: "You are a child-safety classifier. Reject sexual, violent, hateful, exploitative, self-harm, dangerous imitation, or personally identifying content inappropriate for a children's bedtime story." }],
      },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(brief) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: { safe: { type: "boolean" } },
          required: ["safe"],
        },
        temperature: 0,
      },
      safetySettings,
    });
    const parsed = JSON.parse(textFrom(result)) as { safe?: boolean };
    if (!parsed.safe) throw new Error("STORY_INPUT_BLOCKED");
  } catch (error) {
    if (error instanceof Error && error.message === "STORY_INPUT_BLOCKED") throw error;
    console.warn("Story brief moderation unavailable; continuing to guarded story generation", {
      message: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}

export async function generateStoryText(brief: StoryBrief) {
  const attempts = [
    {
      temperature: 0.8,
      system: "You are StoryGlow's senior children's-book writer and bedtime audio-drama director. Create emotionally specific, developmentally appropriate 5-minute bedtime adventures while following child-safety requirements exactly.",
      extra: "",
    },
    {
      temperature: 0.35,
      system: "You write safe JSON-only children's bedtime books. Return only valid JSON matching the requested schema. Do not include markdown or commentary.",
      extra: "\nIf any detail feels sensitive, soften it into a safe family memory instead of refusing. Return complete JSON with exactly 10 pages.",
    },
  ];
  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      const result = await generateContent(serverEnv().GEMINI_TEXT_MODEL, {
    systemInstruction: {
      parts: [{ text: attempt.system }],
    },
    contents: [{
      role: "user",
      parts: [{
        text: `Create a personalized bedtime picture book.

Child: ${brief.childName}
Age: ${brief.age}
Gender/pronoun preference: ${brief.gender}
Parents or grown-ups: ${brief.grownUps || "their loving family"}
Character traits: ${brief.characterTraits || "joyful and curious"}
Event: ${brief.event}
Memorable detail: ${brief.memory}

Requirements:
- Exactly 10 to 12 pages.
- Create a 5-minute bedtime adventure with premium family-animation energy: exciting, funny, emotionally warm, and sleep-safe. Do not copy Disney characters, franchises, lyrics, or exact house style.
- Target 700 to 950 total words across the book.
- Short, lyrical, read-aloud prose appropriate for age ${brief.age}.
- Keep page titles brief and elegant, usually 2 to 5 words, never loud or salesy.
- Word count target by page: ages 2-3 use about 40-80 words, ages 4-5 use about 60-110 words, ages 6-8 use about 90-150 words.
- Center family love, belonging, emotional safety, and the joy of watching the child grow.
- Make the supplied event and memorable detail central and specific.
- Never shame the child or reinforce rigid gender roles.
- No violence, frightening peril, romance, unsafe imitation, adult cosmetics instruction, or brands.
- Finish calmly with the child safe, loved, and ready for sleep.
- Use a strong 5-minute arc: cozy opening, child desire, playful surprise, tiny complication, imaginative high point, emotional discovery, family reflection, then a calm bedtime landing.
- Give every page a concrete illustration scene with the same characters and clothing.
- Every title, dedication, page title, and page text must begin with a capital letter.
- The main child must always read like the same child from page to page, and adult traits must never be transferred onto the child.
- Scene descriptions must ask for one clear moment only, never duplicated versions of the child in the same illustration.
- For every page include storyBeat, audioScenePlan, ambienceKey, effectCues, and characterVoiceHints.
- Audio scene plans should feel like a professional bedtime podcast: narrator tone, optional gentle character dialogue, subtle ambience, soft transition effects, and no startling sounds.
- effectCues must be short bedtime-safe cues such as soft chime, tiny giggle, page whoosh, blanket rustle, sparkle twinkle, gentle footsteps, quiet applause, sleepy sigh.${attempt.extra}`,
      }],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: STORY_JSON_SCHEMA,
      temperature: attempt.temperature,
    },
    safetySettings,
  });
      return normalizeStoryBook(StorySchema.parse(JSON.parse(textFrom(result))));
    } catch (error) {
      if (error instanceof Error && error.message === "STORY_INPUT_BLOCKED") throw error;
      lastError = error;
      console.warn("Story text generation attempt failed", {
        message: error instanceof Error ? error.message : "UNKNOWN",
      });
    }
  }

  console.warn("Story text generation fell back to deterministic local book", {
    message: lastError instanceof Error ? lastError.message : "UNKNOWN",
  });
  return fallbackStoryText(brief);
}

function roleDescription(roles: FamilyRole[] = []) {
  return roles.map(role =>
    `Marker ${role.marker}: ${role.role.replace("_", " ")}${role.displayName ? ` named ${role.displayName}` : ""}`,
  ).join(". ");
}

function characterReferenceSheetPrompt(brief: StoryBrief, familyPhoto?: Buffer) {
  return `${STYLE_MODIFIER}
Create a professional non-photorealistic illustrated character bible sheet for StoryGlow.
Use a clean, organized white or parchment background with thin panel divisions, but no text,
letters, labels, logos, watermarks, or readable markings.

Layout requirements adapted from professional character turnarounds:
- Left side: front, side, and back full-body views of the same core characters.
- Right side: face closeups, hair/back-of-head detail, outfit material detail,
  accessory detail, color swatches, and three expression closeups.
- Expressions should be clearly different but not distorted: playful curious smile,
  sweet gentle smile, and slightly upset or thoughtful bedtime-safe expression.
- Keep face shape, proportions, hair, outfit, accessories, body scale, palette,
  and art style absolutely consistent across all views.
- Preserve child age. Adult-only details must stay with adults.

Main child: ${brief.childName}, age ${brief.age}, ${brief.gender}.
Family: ${brief.grownUps || "loving parent or guardian"}.
Traits from parent: ${brief.characterTraits || "warm, curious, bedtime-friendly child"}.
${familyPhoto ? `Use the supplied family photograph only as private visual reference.
Manual role labels: ${roleDescription(brief.familyRoles)}.
Translate high-level likeness cues into premium illustrated storybook characters.
Do not copy the photo, background, pose, camera perspective, or exact clothing.
Do not over-smooth or beautify beyond the illustrated style; keep distinctive high-level
features such as hair shape, face silhouette, glasses, and family roles consistent.` : ""}

The result is a reusable identity reference sheet for future story covers and pages,
not a final story scene.`;
}

export async function createCharacterReference(brief: StoryBrief, familyPhoto?: Buffer, photoMime = "image/jpeg") {
  const prompt = characterReferenceSheetPrompt(brief, familyPhoto);

  const parts: GeminiPart[] = [{ text: prompt }];
  if (familyPhoto) parts.push({ inlineData: { mimeType: photoMime, data: familyPhoto.toString("base64") } });
  const result = await generateContent(serverEnv().GEMINI_IMAGE_MODEL, {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
    },
    safetySettings,
  });
  return mediaFrom(result).bytes;
}

export async function generatePageIllustration(
  characterReference: Buffer,
  pageTitle: string,
  sceneDescription: string,
  pageNumber: number,
) {
  const result = await generateContent(serverEnv().GEMINI_IMAGE_MODEL, {
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: "image/png", data: characterReference.toString("base64") } },
        {
          text: `${STYLE_MODIFIER}
Create page ${pageNumber} of the same children's picture book using the supplied
illustrated character sheet as the strict identity reference.
Page title context: ${pageTitle}
Scene: ${sceneDescription}
Use the full character bible sheet: match the same front/side/back identity,
expression design, hair shape, outfit details, adult accessories, and color swatches.
Landscape double-page composition, clear focal action, safe age-appropriate
environment, full-bleed illustration only.
Keep clothing, scale, face shape, skin tone, and role-specific accessories consistent
with the reference sheet. Do not add facial hair, glasses, or adult accessories to the
child unless the scene description explicitly calls for it.
Show exactly one instance of the main child. Do not create duplicate copies of the child
or repeat the same character in the background. Do not place any text, title, caption,
letters, labels, signs, book pages with writing, or typography inside the illustration.`,
        },
      ],
    }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "3:2", imageSize: "2K" },
    },
    safetySettings,
  });
  return mediaFrom(result).bytes;
}

export async function generateStandalonePageIllustration(
  brief: StoryBrief,
  pageTitle: string,
  sceneDescription: string,
  pageNumber: number,
  visualStyleLock?: string | null,
) {
  const result = await generateContent(serverEnv().GEMINI_IMAGE_MODEL, {
    contents: [{
      role: "user",
      parts: [{
        text: `${STYLE_MODIFIER}
Create page ${pageNumber} of a personalized children's picture book.
This is a direct scene illustration fallback because the reusable character sheet is
not available yet. Still make the image specific to the family story.

Main child: ${brief.childName}, age ${brief.age}, ${brief.gender}
Parents or grown-ups: ${brief.grownUps || "their loving family"}
Character traits: ${brief.characterTraits || "joyful and curious"}
Event: ${brief.event}
Memorable detail: ${brief.memory}
${visualStyleLock ? `Selected cover/style lock to follow exactly:
${visualStyleLock}
` : ""}
Page title context: ${pageTitle}
Scene: ${sceneDescription}

Landscape double-page composition, clear focal action, safe age-appropriate
environment, full-bleed illustration only.
Keep the main child visually consistent with this brief. Show exactly one instance of
the main child. Do not create duplicate copies of the child or repeat the same character
in the background. Do not place any text, title, caption, letters, labels, signs, book
pages with writing, or typography inside the illustration.`,
      }],
    }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "3:2", imageSize: "2K" },
    },
    safetySettings,
  });
  return mediaFrom(result).bytes;
}

export async function generateCoverIllustration(
  characterReference: Buffer,
  title: string,
  dedication: string,
  brief: StoryBrief,
  emotionalHook: string,
) {
  const result = await generateContent(serverEnv().GEMINI_IMAGE_MODEL, {
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: "image/png", data: characterReference.toString("base64") } },
        {
          text: `${STYLE_MODIFIER}
Create a dedicated premium personalized storybook cover using the supplied
illustrated character sheet as the strict identity reference.
Book title context: ${title}
Dedication tone: ${dedication}
Main child: ${brief.childName}, age ${brief.age}
Family: ${brief.grownUps || "loving parent or guardian"}
Emotional hook: ${emotionalHook}
Use the full character bible sheet: match identity, outfit, expression logic,
adult accessories, child age, and palette exactly.

Cover requirements:
- This is the front cover illustration, not page 1 interior art.
- Strong thumbnail readability on a mobile library card.
- Clear emotional invitation: family love, wonder, and the memorable detail.
- One iconic focal composition with the main child instantly recognizable.
- Full-bleed cover art only; the app renders the title separately in HTML.
- Show exactly one instance of the main child, with no duplicate copies or repeated
  background versions of the same character.
- Keep the premium animated storybook lighting, soft paper texture, and cohesive palette.
- No text, letters, title, captions, labels, logos, watermarks, or photorealism inside the image.`,
        },
      ],
    }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "3:2", imageSize: "2K" },
    },
    safetySettings,
  });
  return mediaFrom(result).bytes;
}

export async function generateCoverOptionIllustration({
  title,
  dedication,
  brief,
  emotionalHook,
  option,
  visualStyleLock,
}: {
  title: string;
  dedication: string;
  brief: StoryBrief;
  emotionalHook: string;
  option: CoverStyleOption;
  visualStyleLock: string;
}) {
  const result = await generateContent(serverEnv().GEMINI_IMAGE_MODEL, {
    contents: [{
      role: "user",
      parts: [{
        text: `${STYLE_MODIFIER}
Create one of three selectable cover directions for a personalized children's picture book.
This is option: ${option.label}.
Art direction: ${option.promptSummary}

Book title context: ${title}
Dedication tone: ${dedication}
Main child: ${brief.childName}, age ${brief.age}, ${brief.gender}
Family: ${brief.grownUps || "loving parent or guardian"}
Character traits: ${brief.characterTraits || "joyful and curious"}
Event: ${brief.event}
Memorable detail: ${brief.memory}
Emotional hook: ${emotionalHook}

Visual style lock for later interior pages:
${visualStyleLock}

Cover requirements:
- This is a front cover illustration option, not page 1 interior art.
- Make this option visually distinct from the other cover styles while still premium and bedtime-safe.
- Strong thumbnail readability on a mobile library card.
- One iconic focal composition with the main child instantly recognizable.
- Full-bleed cover art only; the app renders all text separately in HTML.
- Show exactly one instance of the main child, with no duplicate copies or repeated background versions.
- No text, letters, title, captions, labels, logos, watermarks, or photorealism inside the image.`,
      }],
    }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "3:2", imageSize: "2K" },
    },
    safetySettings,
  });
  return mediaFrom(result).bytes;
}
export async function generateStandaloneCoverIllustration(
  title: string,
  dedication: string,
  brief: StoryBrief,
  emotionalHook: string,
) {
  const result = await generateContent(serverEnv().GEMINI_IMAGE_MODEL, {
    contents: [{
      role: "user",
      parts: [{
        text: `${STYLE_MODIFIER}
Create a dedicated premium personalized storybook cover.
This is a direct cover illustration fallback because the reusable character sheet is
not available yet. Still make the cover specific to the child and memory.

Book title context: ${title}
Dedication tone: ${dedication}
Main child: ${brief.childName}, age ${brief.age}
Family: ${brief.grownUps || "loving parent or guardian"}
Character traits: ${brief.characterTraits || "joyful and curious"}
Event: ${brief.event}
Memorable detail: ${brief.memory}
Emotional hook: ${emotionalHook}

Cover requirements:
- This is the front cover illustration, not page 1 interior art.
- Strong thumbnail readability on a mobile library card.
- Clear emotional invitation: family love, wonder, and the memorable detail.
- One iconic focal composition with the main child instantly recognizable.
- Full-bleed cover art only; the app renders the title separately in HTML.
- Show exactly one instance of the main child, with no duplicate copies or repeated
  background versions of the same character.
- No text, letters, title, captions, labels, logos, watermarks, or photorealism inside the image.`,
      }],
    }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "3:2", imageSize: "2K" },
    },
    safetySettings,
  });
  return mediaFrom(result).bytes;
}

function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function generateNarrationAudio(title: string, text: string) {
  const result = await generateContent(serverEnv().GEMINI_TTS_MODEL, {
    contents: [{
      role: "user",
      parts: [{ text: `Read this as a warm, calm bedtime storyteller with gentle pacing and a reassuring, expressive but never loud tone:\n\n${title}. ${text}` }],
    }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
      },
    },
  });
  const media = mediaFrom(result);
  return media.mimeType.includes("wav") ? media.bytes : pcmToWav(media.bytes);
}
