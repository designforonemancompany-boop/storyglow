import { z } from "zod";
import { serverEnv } from "@/lib/env";
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
  return result.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim() || "";
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
  const result = await generateContent(serverEnv().GEMINI_TEXT_MODEL, {
    systemInstruction: {
      parts: [{ text: "You are StoryGlow's senior children's-book writer. Create emotionally specific, developmentally appropriate bedtime books while following child-safety requirements exactly." }],
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
- The main child must always read like the same child from page to page, and adult traits must never be transferred onto the child.`,
      }],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: STORY_JSON_SCHEMA,
      temperature: 0.8,
    },
    safetySettings,
  });
  return StorySchema.parse(JSON.parse(textFrom(result)));
}

function roleDescription(roles: FamilyRole[] = []) {
  return roles.map(role =>
    `Marker ${role.marker}: ${role.role.replace("_", " ")}${role.displayName ? ` named ${role.displayName}` : ""}`,
  ).join(". ");
}

export async function createCharacterReference(brief: StoryBrief, familyPhoto?: Buffer, photoMime = "image/jpeg") {
  const prompt = `${STYLE_MODIFIER}
Create a clean illustrated character reference sheet for a personalized children's book.
Main child: ${brief.childName}, age ${brief.age}, ${brief.characterTraits}.
Family: ${brief.grownUps || "loving parent or guardian"}.
${familyPhoto ? `Use the supplied family photograph only as a private visual reference. Manual role labels: ${roleDescription(brief.familyRoles)}. Translate recognizable high-level features into gentle cartoon storybook characters without copying the photograph, background, pose, or clothing.` : ""}
Show each character once, full body, neutral friendly pose, consistent proportions,
simple clothing palette, and an uncluttered parchment background.
Create a visual character bible: assign each person a stable silhouette, hair shape,
skin tone, clothing palette, and role-specific accessories. Never give adult-only
features such as beards, glasses, or handbags to the child unless the prompt explicitly
requests the child wearing that item in a scene.`;

  const parts: GeminiPart[] = [{ text: prompt }];
  if (familyPhoto) parts.push({ inlineData: { mimeType: photoMime, data: familyPhoto.toString("base64") } });
  const result = await generateContent(serverEnv().GEMINI_IMAGE_MODEL, {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "3:2", imageSize: "2K" },
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
