import { FieldValue } from "firebase-admin/firestore";
import { serverEnv } from "@/lib/env";
import { firestore } from "@/lib/firebase/admin";

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

function feedbackPriority(payload: FeedbackNotification) {
  const text = `${payload.kind} ${payload.message}`.toLowerCase();
  if (/\b(fail|failed|error|bug|can't|cannot|broken|crash|payment|login|sign[- ]?in|fetch)\b/.test(text)) {
    return "high";
  }
  if (payload.kind === "idea") return "normal";
  return "medium";
}

function proposedSolution(payload: FeedbackNotification) {
  const text = payload.message.toLowerCase();
  if (text.includes("fetch") || text.includes("create") || text.includes("generate")) {
    return "Review Cloud Run logs and the affected route, reproduce the create-story flow, then patch the backend or UI so the parent receives a clear recoverable state.";
  }
  if (text.includes("audio") || payload.kind === "story_feedback") {
    return "Review the story/player context, tune narration or content behavior, and verify the fix on mobile and desktop.";
  }
  if (payload.kind === "bug") {
    return "Reproduce the reported bug, identify the failing route or component, add a focused guard/test, and verify the live app after deployment.";
  }
  return "Review the suggestion for beta value, decide whether it belongs in the MVP backlog, and capture the next product action.";
}

export async function createFeedbackReview(payload: FeedbackNotification) {
  const priority = feedbackPriority(payload);
  const reviewRef = firestore().collection("feedbackReviews").doc(payload.id);
  await reviewRef.set({
    feedback_id: payload.id,
    user_id: payload.userId,
    story_id: payload.storyId,
    kind: payload.kind,
    priority,
    status: "needs_review",
    proposed_solution: proposedSolution(payload),
    user_impact_summary: payload.message.slice(0, 500),
    source_page_url: payload.pageUrl,
    audio_cadence: payload.audioCadence,
    reward_credits: payload.rewardCredits,
    assigned_to: "StoryGlow admin",
    reviewed_at: null,
    resolution_notes: null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { reviewId: reviewRef.id, priority };
}

export async function notifyFeedback(payload: FeedbackNotification) {
  const review = await createFeedbackReview(payload);
  const env = serverEnv();
  if (!env.FEEDBACK_WEBHOOK_URL) {
    console.info("StoryGlow feedback review", { ...payload, ...review });
    return { delivered: false, mode: "log" as const, ...review };
  }
  const response = await fetch(env.FEEDBACK_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.FEEDBACK_WEBHOOK_SECRET
        ? { Authorization: `Bearer ${env.FEEDBACK_WEBHOOK_SECRET}` }
        : {}),
    },
    body: JSON.stringify({ ...payload, ...review }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Feedback webhook returned ${response.status}`);
  return { delivered: true, mode: "webhook" as const, ...review };
}
