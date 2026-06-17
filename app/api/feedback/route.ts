import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase/admin";
import { notifyFeedback } from "@/lib/feedback";
import { ownedStory } from "@/lib/firestore-data";
import { getOptionalUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-access";
import { serverEnv } from "@/lib/env";

const FeedbackSchema = z.object({
  storyId: z.string().min(10).max(80).nullable().optional(),
  kind: z.enum(["bug", "idea", "story_feedback"]),
  audioCadence: z.enum(["too_fast", "just_right", "too_slow"]),
  message: z.string().trim().min(3).max(2000),
  pageUrl: z.string().url().max(1000).optional(),
});

function iso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

async function canReadFeedback(request: Request) {
  const env = serverEnv();
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (env.FEEDBACK_WEBHOOK_SECRET && token && token === env.FEEDBACK_WEBHOOK_SECRET) return true;

  const user = await getOptionalUser();
  return isAdminEmail(user?.email, Boolean(user?.email_verified));
}

export async function GET(request: Request) {
  if (!await canReadFeedback(request)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  const snapshot = await firestore()
    .collection("userFeedback")
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();

  const reviews = await Promise.all(snapshot.docs.map(doc =>
    firestore().collection("feedbackReviews").doc(doc.id).get().catch(() => null),
  ));

  return NextResponse.json({
    count: snapshot.size,
    feedback: snapshot.docs.map((doc, index) => {
      const data = doc.data();
      const review = reviews[index]?.exists ? reviews[index]?.data() : null;
      return {
        id: doc.id,
        created_at: iso(data.created_at),
        kind: data.kind || null,
        audio_cadence: data.audio_cadence || null,
        story_id: data.story_id || null,
        page_url: data.page_url || null,
        reward_credits: data.reward_credits || 0,
        message: data.message || "",
        review: review ? {
          status: review.status || null,
          priority: review.priority || null,
          proposed_solution: review.proposed_solution || null,
          resolution_notes: review.resolution_notes || null,
          reviewed_at: iso(review.reviewed_at),
        } : null,
      };
    }),
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const parsed = FeedbackSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    if (parsed.data.storyId && !await ownedStory(user.uid, parsed.data.storyId)) {
      return NextResponse.json({ error: "Story not found." }, { status: 404 });
    }

    const db = firestore();
    const feedbackRef = db.collection("userFeedback").doc();
    const feedbackQuery = db.collection("userFeedback").where("user_id", "==", user.uid);
    const recentThreshold = Timestamp.fromMillis(Date.now() - 60_000);
    let rewardCredits = 0;
    await db.runTransaction(async transaction => {
      const [profile, alpha, existing] = await Promise.all([
        transaction.get(db.collection("profiles").doc(user.uid)),
        transaction.get(db.collection("alphaTesters").doc(user.uid)),
        transaction.get(feedbackQuery),
      ]);
      const recentCount = existing.docs.filter(doc => {
        const createdAt = doc.data().created_at as Timestamp | undefined;
        return createdAt && createdAt.toMillis() >= recentThreshold.toMillis();
      }).length;
      if (recentCount >= 3) throw new Error("FEEDBACK_RATE_LIMIT");

      if (existing.empty && alpha.exists) {
        rewardCredits = 5;
      } else if (parsed.data.storyId) {
        const distinctStories = new Set(
          existing.docs.map(doc => doc.data().story_id).filter(Boolean),
        );
        distinctStories.add(parsed.data.storyId);
        const alreadyReceivedSecondReward = existing.docs.some(doc => doc.data().reward_credits === 1);
        if (distinctStories.size >= 2 && !alreadyReceivedSecondReward) rewardCredits = 1;
      }

      transaction.set(feedbackRef, {
        user_id: user.uid,
        story_id: parsed.data.storyId || null,
        kind: parsed.data.kind,
        audio_cadence: parsed.data.audioCadence,
        message: parsed.data.message,
        page_url: parsed.data.pageUrl || null,
        user_agent: request.headers.get("user-agent"),
        reward_credits: rewardCredits,
        created_at: FieldValue.serverTimestamp(),
      });
      if (rewardCredits > 0) {
        transaction.set(profile.ref, {
          storybookCredits: FieldValue.increment(rewardCredits),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });

    const createdAt = new Date().toISOString();
    after(async () => {
      try {
        await notifyFeedback({
          id: feedbackRef.id,
          userId: user.uid,
          storyId: parsed.data.storyId || null,
          kind: parsed.data.kind,
          audioCadence: parsed.data.audioCadence,
          message: parsed.data.message,
          pageUrl: parsed.data.pageUrl || null,
          rewardCredits,
          createdAt,
        });
      } catch (error) {
        console.error("Feedback notification failed", error);
      }
    });
    return NextResponse.json({ saved: true, rewardCredits });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in to send feedback." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FEEDBACK_RATE_LIMIT") {
      return NextResponse.json({ error: "Please wait a moment before sending more feedback." }, { status: 429 });
    }
    return NextResponse.json({ error: "Could not save feedback." }, { status: 500 });
  }
}
