import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase/admin";

const BodySchema = z.object({ marketingOptIn: z.boolean() });

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid preference." }, { status: 400 });
    const db = firestore();
    const batch = db.batch();
    batch.set(db.collection("profiles").doc(user.uid), {
      marketingOptIn: parsed.data.marketingOptIn,
      marketingUpdatedAt: FieldValue.serverTimestamp(),
      marketingWithdrawnAt: parsed.data.marketingOptIn ? null : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(db.collection("marketingConsentEvents").doc(), {
      userId: user.uid,
      optedIn: parsed.data.marketingOptIn,
      source: parsed.data.marketingOptIn ? "preferences" : "unsubscribe",
      wordingVersion: "2026-06-14-v1",
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return NextResponse.json({ saved: true });
  } catch (error) {
    const status = error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Sign in required" : "Could not save preferences" }, { status });
  }
}
