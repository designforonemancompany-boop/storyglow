import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-access";
import { firestore } from "@/lib/firebase/admin";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function iso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

async function authorized(request: Request) {
  const env = serverEnv();
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (env.FEEDBACK_WEBHOOK_SECRET && token && token === env.FEEDBACK_WEBHOOK_SECRET) return true;

  const user = await getOptionalUser();
  return isAdminEmail(user?.email, Boolean(user?.email_verified));
}

export async function GET(request: Request) {
  if (!await authorized(request)) {
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
