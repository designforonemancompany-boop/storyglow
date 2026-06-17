import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@/lib/auth";
import { firebaseAdminAuth, firestore } from "@/lib/firebase/admin";

const BodySchema = z.object({
  idToken: z.string().min(100),
  marketingOptIn: z.boolean().default(false),
  source: z.enum(["email_signin", "google_signin", "password_signin"]).default("google_signin"),
});

const EXPIRES_IN = 14 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid sign-in session." }, { status: 400 });

  const auth = firebaseAdminAuth();
  const decoded = await auth.verifyIdToken(parsed.data.idToken, true);
  const isPasswordSignIn = parsed.data.source === "password_signin"
    && decoded.firebase?.sign_in_provider === "password";
  if (!decoded.email || (!decoded.email_verified && !isPasswordSignIn)) {
    return NextResponse.json({ error: "A verified email is required." }, { status: 403 });
  }

  const db = firestore();
  await db.runTransaction(async transaction => {
    const profileRef = db.collection("profiles").doc(decoded.uid);
    const profile = await transaction.get(profileRef);
    const counterRef = db.collection("system").doc("alphaTesterCounter");
    const counter = await transaction.get(counterRef);
    const now = FieldValue.serverTimestamp();
    let recordConsent = false;

    if (!profile.exists) {
      const currentCount = Number(counter.data()?.count || 0);
      const testerNumber = currentCount < 20 ? currentCount + 1 : null;
      transaction.set(profileRef, {
        email: decoded.email,
        displayName: decoded.name || "",
        avatarUrl: decoded.picture || "",
        authProviders: decoded.firebase?.sign_in_provider ? [decoded.firebase.sign_in_provider] : [],
        emailVerified: Boolean(decoded.email_verified),
        storybookCredits: 0,
        freeStoriesUsed: 0,
        marketingOptIn: parsed.data.marketingOptIn,
        marketingUpdatedAt: now,
        marketingWithdrawnAt: null,
        createdAt: now,
        updatedAt: now,
      });
      recordConsent = true;
      if (testerNumber) {
        transaction.set(db.collection("alphaTesters").doc(decoded.uid), {
          testerNumber,
          enrolledAt: now,
        });
        transaction.set(counterRef, { count: testerNumber }, { merge: true });
      }
    } else {
      const providers = new Set<string>(profile.data()?.authProviders || []);
      if (decoded.firebase?.sign_in_provider) providers.add(decoded.firebase.sign_in_provider);
      const newlyOptingIn = parsed.data.marketingOptIn && !profile.data()?.marketingOptIn;
      transaction.set(profileRef, {
        email: decoded.email,
        emailVerified: Boolean(decoded.email_verified),
        displayName: profile.data()?.displayName || decoded.name || "",
        avatarUrl: profile.data()?.avatarUrl || decoded.picture || "",
        authProviders: [...providers],
        ...(newlyOptingIn ? {
          marketingOptIn: true,
          marketingUpdatedAt: now,
          marketingWithdrawnAt: null,
        } : {}),
        updatedAt: now,
      }, { merge: true });
      recordConsent = newlyOptingIn;
    }

    if (recordConsent) {
      const consentRef = db.collection("marketingConsentEvents").doc();
      transaction.set(consentRef, {
        userId: decoded.uid,
        optedIn: parsed.data.marketingOptIn,
        source: parsed.data.source,
        wordingVersion: "2026-06-14-v1",
        createdAt: now,
      });
    }
  });

  const sessionCookie = await auth.createSessionCookie(parsed.data.idToken, { expiresIn: EXPIRES_IN });
  const response = NextResponse.json({ signedIn: true });
  response.cookies.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: EXPIRES_IN / 1000,
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
