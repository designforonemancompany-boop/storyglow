import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { firebaseAdminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE = "storyglow_session";

export type StoryGlowUser = DecodedIdToken & {
  name?: string;
  picture?: string;
};

export async function getOptionalUser(): Promise<StoryGlowUser | null> {
  try {
    const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!cookie) return null;
    return await firebaseAdminAuth().verifySessionCookie(cookie, true) as StoryGlowUser;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getOptionalUser();
  if (!user) redirect("/signin");
  return user;
}

export async function requireApiUser() {
  const user = await getOptionalUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  return user;
}
