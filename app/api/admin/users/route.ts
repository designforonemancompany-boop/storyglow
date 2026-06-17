import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin-access";
import { firebaseAdminAuth, firestore } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminApiUser();
    const url = new URL(request.url);
    const email = url.searchParams.get("email")?.trim();
    const uid = url.searchParams.get("uid")?.trim();
    if (!email && !uid) return NextResponse.json({ error: "Search by email or UID." }, { status: 400 });

    const authUser = email
      ? await firebaseAdminAuth().getUserByEmail(email)
      : await firebaseAdminAuth().getUser(uid as string);
    const profile = await firestore().collection("profiles").doc(authUser.uid).get();
    const data = profile.exists ? profile.data() : {};

    return NextResponse.json({
      user: {
        uid: authUser.uid,
        email: authUser.email || data?.email || "",
        displayName: authUser.displayName || data?.displayName || "",
        storybookCredits: Number(data?.storybookCredits || 0),
        freeStoriesUsed: Number(data?.freeStoriesUsed || 0),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
}
