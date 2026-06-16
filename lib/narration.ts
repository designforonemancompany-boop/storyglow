import { generateNarrationAudio } from "@/lib/google-ai";
import { storageBucket } from "@/lib/firebase/admin";

const WAV_HEADER_BYTES = 44;
const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_CHANNELS = 1;
const DEFAULT_BYTES_PER_SAMPLE = 2;

function estimateNarrationDurationMs(audio: Buffer) {
  const pcmBytes = Math.max(0, audio.length - WAV_HEADER_BYTES);
  const bytesPerSecond = DEFAULT_SAMPLE_RATE * DEFAULT_CHANNELS * DEFAULT_BYTES_PER_SAMPLE;
  return Math.round((pcmBytes / bytesPerSecond) * 1000);
}

export function narrationStoragePath(userId: string, storyId: string, pageNumber: number) {
  return `story-media/${userId}/${storyId}/page-${pageNumber}.wav`;
}

export async function renderNarrationAsset({
  userId,
  storyId,
  pageNumber,
  title,
  body,
}: {
  userId: string;
  storyId: string;
  pageNumber: number;
  title: string;
  body: string;
}) {
  const audio = await generateNarrationAudio(title, body);
  const narrationPath = narrationStoragePath(userId, storyId, pageNumber);
  await storageBucket().file(narrationPath).save(audio, {
    resumable: false,
    contentType: "audio/wav",
    metadata: {
      cacheControl: "private,max-age=3600",
      metadata: { ownerId: userId, storyId },
    },
  });
  return {
    narrationPath,
    narrationDurationMs: estimateNarrationDurationMs(audio),
  };
}
