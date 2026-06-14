import { serverEnv } from "@/lib/env";

export type FeedbackNotification = {
  id: string;
  userId: string;
  storyId: string | null;
  kind: string;
  audioCadence: string;
  message: string;
  pageUrl: string | null;
  rewardCredits: number;
  createdAt: string;
};

export async function notifyFeedback(payload: FeedbackNotification) {
  const env = serverEnv();
  if (!env.FEEDBACK_WEBHOOK_URL) {
    console.info("StoryGlow feedback", payload);
    return { delivered: false, mode: "log" as const };
  }
  const response = await fetch(env.FEEDBACK_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.FEEDBACK_WEBHOOK_SECRET
        ? { Authorization: `Bearer ${env.FEEDBACK_WEBHOOK_SECRET}` }
        : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Feedback webhook returned ${response.status}`);
  return { delivered: true, mode: "webhook" as const };
}
