import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const RefinementSchema = z.object({
  parentRefinementNotes: z.string().trim().max(900),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const parsed = RefinementSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please keep notes under 900 characters." }, { status: 400 });

    const ref = firestore().collection("familyCharacters").doc(id);
    const doc = await ref.get();
    if (!doc.exists || doc.data()?.owner_id !== user.uid) {
      return NextResponse.json({ error: "Character not found." }, { status: 404 });
    }

    await ref.update({
      "trait_bible.parentRefinementNotes": parsed.data.parentRefinementNotes,
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    return NextResponse.json({ error: "Could not save character notes." }, { status: 500 });
  }
}
