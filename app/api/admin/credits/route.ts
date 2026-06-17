import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiUser } from "@/lib/admin-access";
import { firestore } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const CreditSchema = z.object({
  userId: z.string().min(10).max(128),
  delta: z.number().int().min(-20).max(20).refine(value => value !== 0, "Credit change cannot be zero."),
  reason: z.string().trim().min(8).max(500),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApiUser();
    const parsed = CreditSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid credit change." }, { status: 400 });
    }

    const db = firestore();
    const profileRef = db.collection("profiles").doc(parsed.data.userId);
    const ledgerRef = db.collection("creditLedger").doc();
    let newBalance = 0;

    await db.runTransaction(async transaction => {
      const profile = await transaction.get(profileRef);
      if (!profile.exists) throw new Error("USER_NOT_FOUND");
      const current = Number(profile.data()?.storybookCredits || 0);
      newBalance = current + parsed.data.delta;
      if (newBalance < 0) throw new Error("NEGATIVE_BALANCE");

      transaction.set(profileRef, {
        storybookCredits: newBalance,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(ledgerRef, {
        user_id: parsed.data.userId,
        delta: parsed.data.delta,
        previous_balance: current,
        new_balance: newBalance,
        reason: parsed.data.reason,
        admin_email: admin.email || "",
        admin_uid: admin.uid,
        source: "manual_beta_admin",
        created_at: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      saved: true,
      storybookCredits: newBalance,
      ledgerId: ledgerRef.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "NEGATIVE_BALANCE") {
      return NextResponse.json({ error: "Credit balance cannot go below zero." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not update credits." }, { status: 500 });
  }
}
