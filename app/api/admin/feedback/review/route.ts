import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiUser } from "@/lib/admin-access";
import { firestore } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const ReviewSchema = z.object({
  feedbackId: z.string().min(8).max(120),
  status: z.enum(["new", "reviewing", "planned", "fixed", "closed"]),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  proposedSolution: z.string().trim().max(1200).optional(),
  internalNotes: z.string().trim().max(1200).optional(),
});

function iso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApiUser();
    const parsed = ReviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid review." }, { status: 400 });
    }

    const db = firestore();
    const feedback = await db.collection("userFeedback").doc(parsed.data.feedbackId).get();
    if (!feedback.exists) return NextResponse.json({ error: "Feedback not found." }, { status: 404 });

    const payload = {
      feedback_id: parsed.data.feedbackId,
      status: parsed.data.status,
      priority: parsed.data.priority,
      proposed_solution: parsed.data.proposedSolution || "",
      internal_notes: parsed.data.internalNotes || "",
      reviewed_by: admin.email || admin.uid,
      reviewed_by_uid: admin.uid,
      reviewed_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    await db.collection("feedbackReviews").doc(parsed.data.feedbackId).set(payload, { merge: true });
    return NextResponse.json({
      saved: true,
      review: {
        ...payload,
        reviewed_at: iso(new Date()),
        updated_at: iso(new Date()),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    return NextResponse.json({ error: "Could not save feedback review." }, { status: 500 });
  }
}
