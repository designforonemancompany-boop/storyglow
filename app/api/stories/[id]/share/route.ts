import { createHash, randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { ownedStory } from "@/lib/firestore-data";
import { firestore } from "@/lib/firebase/admin";
import { serverEnv } from "@/lib/env";

const BodySchema = z.object({ expiresInDays: z.number().int().min(0).max(90).default(30) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireApiUser();
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid expiry" }, { status: 400 });
    if (!await ownedStory(user.uid, id)) return NextResponse.json({ error: "Story not found" }, { status: 404 });

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await firestore().collection("shareLinks").doc(tokenHash).set({
      story_id: id,
      owner_id: user.uid,
      expires_at: parsed.data.expiresInDays
        ? new Date(Date.now() + parsed.data.expiresInDays * 86400000)
        : null,
      revoked_at: null,
      created_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ url: `${serverEnv().NEXT_PUBLIC_SITE_URL}/share/${token}` });
  } catch (error) {
    const status = error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Sign in required" : "Could not create link" }, { status });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireApiUser();
    const links = await firestore().collection("shareLinks")
      .where("story_id", "==", id).where("owner_id", "==", user.uid).get();
    const batch = firestore().batch();
    links.docs.forEach(doc => batch.update(doc.ref, { revoked_at: FieldValue.serverTimestamp() }));
    await batch.commit();
    return NextResponse.json({ revoked: true });
  } catch (error) {
    const status = error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Sign in required" : "Could not revoke link" }, { status });
  }
}
