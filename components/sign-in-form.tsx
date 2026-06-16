"use client";

import {
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  signInWithPopup,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { firebaseBrowserAuth } from "@/lib/firebase/browser";

export function SignInForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function magicLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      localStorage.setItem("storyglow-post-auth-path", nextPath);
      await sendSignInLinkToEmail(await firebaseBrowserAuth(), email, {
        url: `${location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        handleCodeInApp: true,
      });
      localStorage.setItem("storyglow-email", email);
      localStorage.setItem("storyglow-pending-marketing", String(marketing));
      setMessage("Check your email for your secure sign-in link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setMessage("");
    try {
      const credential = await signInWithPopup(await firebaseBrowserAuth(), new GoogleAuthProvider());
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, marketingOptIn: marketing, source: "google_signin" }),
      });
      if (!response.ok) throw new Error("Could not create your StoryGlow session.");
      localStorage.removeItem("storyglow-post-auth-path");
      router.push(nextPath);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-panel">
      <p className="section-label">Keep their story safe</p>
      <h1>Sign in to StoryGlow</h1>
      <p>Use Google or a secure email link to open your private story library on any device.</p>
      <form onSubmit={magicLink}>
        <label>Email address<input value={email} onChange={event => setEmail(event.target.value)} type="email" required autoComplete="email" /></label>
        <label className="checkbox"><input checked={marketing} onChange={event => setMarketing(event.target.checked)} type="checkbox" /><span>Send me occasional StoryGlow news and new story ideas.</span></label>
        <button className="button full" disabled={busy}>Email me a sign-in link</button>
      </form>
      <div className="or"><span>or</span></div>
      <button className="google-button" onClick={google} disabled={busy}><b>G</b> Continue with Google</button>
      <p className="form-message" role="status">{message}</p>
      <small>Story access and service emails never depend on marketing consent.</small>
    </div>
  );
}
