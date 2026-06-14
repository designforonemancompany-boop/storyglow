import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { storageBucket } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) return NextResponse.json({ error: "Photo required" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Photo must be under 10 MB" }, { status: 413 });
    if (!["image/jpeg", "image/png", "image/heic", "image/heif"].includes(file.type)) {
      return NextResponse.json({ error: "Use JPG, PNG, or HEIC" }, { status: 415 });
    }
    const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
    const path = `family-uploads/${user.uid}/${crypto.randomUUID()}.${extension}`;
    await storageBucket().file(path).save(Buffer.from(await file.arrayBuffer()), {
      resumable: false,
      contentType: file.type,
      metadata: { cacheControl: "private,no-store", metadata: { ownerId: user.uid } },
    });
    return NextResponse.json({ path });
  } catch (error) {
    const status = error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Sign in required" : "Photo upload failed" }, { status });
  }
}
