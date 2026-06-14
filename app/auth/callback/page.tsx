"use client";

import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { firebaseBrowserAuth } from "@/lib/firebase/browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing your secure sign-in...");

  useEffect(() => {
    async function finish() {
      try {
        const auth = firebaseBrowserAuth();
        if (!isSignInWithEmailLink(auth, window.location.href)) throw new Error("This sign-in link is invalid or expired.");
        const email = window.localStorage.getItem("storyglow-email");
        if (!email) throw new Error("Open this link on the device where you requested it, or request a new link.");
        const credential = await signInWithEmailLink(auth, email, window.location.href);
        const idToken = await credential.user.getIdToken();
        const marketingOptIn = window.localStorage.getItem("storyglow-pending-marketing") === "true";
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, marketingOptIn, source: "email_signin" }),
        });
        if (!response.ok) throw new Error("Could not create your StoryGlow session.");
        window.localStorage.removeItem("storyglow-email");
        window.localStorage.removeItem("storyglow-pending-marketing");
        router.replace("/create");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Sign-in failed.");
      }
    }
    void finish();
  }, [router]);

  return <main className="page-content"><section className="auth-panel"><h1>StoryGlow</h1><p role="status">{message}</p></section></main>;
}
