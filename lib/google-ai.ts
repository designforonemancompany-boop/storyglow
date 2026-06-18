import { z } from "zod";
import { presetPromptSummary } from "@/lib/character-presets";
import { serverEnv } from "@/lib/env";
import { fallbackStoryText } from "@/lib/story-fallback";
import type { FamilyRole, StoryBrief } from "@/lib/types";

const StorySchema = z.object({
  title: z.string().min(3).max(90),
  dedication: z.string().min(10).max(220),
  pages: z.array(z.object({
    title: z.string().min(2).max(70),
    text: z.string().min(40).max(520),
    sceneDescription: z.string().min(20).max(500),
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
        },
        required: ["title", "text", "sceneDescription"],
      },
    },
  },
  required: ["title", "dedication", "pages"],
};

export const STYLE_MODIFIER = `
Warm, whimsical, premium custom children's-book illustration. Never photorealistic.
Clean watercolor overlays, soft tactile paper texture, expressive cartoon character
designs, gentle gouache and colored-pencil detail, sophisticated page composition,
and a cohesive palette of parchment white, midnight navy, sky blue, marigold,
raspberry coral, and leaf green. Preserve exact illustrated character identity,
skin tone, hair, age, facial proportions, clothing motifs, and family relationships.
Adult-only features such as facial hair, glasses, handbags, or accessories must stay
with the correctly labeled adult and must never migrate onto the child unless the brief
explicitly says the child is wearing that same item in the scene. No logos, readable
words, watermark, uncanny realism, or glossy 3D rendering.
`;

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
      system: "You are StoryGlow's senior children's-book writer. Create emotionally specific, developmentally appropriate bedtime books while following child-safety requirements exactly.",
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
- Short, lyrical, read-aloud prose appropriate for age ${brief.age}.
- Keep page titles brief and elegant, usually 2 to 5 words, never loud or salesy.
- Word count target by page: ages 2-3 use about 40-80 words, ages 4-5 use about 60-110 words, ages 6-8 use about 90-150 words.
- Center family love, belonging, emotional safety, and the joy of watching the child grow.
- Make the supplied event and memorable detail central and specific.
- Never shame the child or reinforce rigid gender roles.
- No violence, frightening peril, romance, unsafe imitation, adult cosmetics instruction, or brands.
- Finish calmly with the child safe, loved, and ready for sleep.
- Use a clear emotional arc: cozy setup, playful discovery, heartfelt family reflection, then a calm bedtime landing.
- Give every page a concrete illustration scene with the same characters and clothing.
- The main child must always read like the same child from page to page, and adult traits must never be transferred onto the child.${attempt.extra}`,
      }],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: STORY_JSON_SCHEMA,
      temperature: attempt.temperature,
    },
    safetySettings,
  });
      return StorySchema.parse(JSON.parse(textFrom(result)));
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
Preset character choices, if any:
${presetPromptSummary(brief)}

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
environment, and quiet space for separately rendered HTML story text.
Keep clothing, scale, face shape, skin tone, and role-specific accessories consistent
with the reference sheet. Do not add facial hair, glasses, or adult accessories to the
child unless the scene description explicitly calls for it. Do not place text inside the
illustration.`,
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
Preset character choices:
${presetPromptSummary(brief)}
Page title context: ${pageTitle}
Scene: ${sceneDescription}

Landscape double-page composition, clear focal action, safe age-appropriate
environment, and quiet space for separately rendered HTML story text.
Keep the main child visually consistent with this brief, and do not place text inside
the illustration.`,
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
- This is a cover, not page 1 interior art.
- Strong thumbnail readability on a mobile library card.
- Clear emotional invitation: family love, wonder, and the memorable detail.
- One iconic focal composition with the main child instantly recognizable.
- Leave generous clean space where HTML can render the title separately.
- Keep the premium watercolor, soft paper texture, and cohesive palette.
- No text, logos, watermarks, or photorealism inside the image.`,
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
Preset character choices:
${presetPromptSummary(brief)}
Emotional hook: ${emotionalHook}

Cover requirements:
- This is a cover, not page 1 interior art.
- Strong thumbnail readability on a mobile library card.
- Clear emotional invitation: family love, wonder, and the memorable detail.
- One iconic focal composition with the main child instantly recognizable.
- Leave generous clean space where HTML can render the title separately.
- No text, logos, watermarks, or photorealism inside the image.`,
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
