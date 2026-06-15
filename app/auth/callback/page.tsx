"use client";

import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { firebaseBrowserAuth } from "@/lib/firebase/browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing your secure sign-in...");
  const [email, setEmail] = useState("");
  const [needsEmail, setNeedsEmail] = useState(false);

  useEffect(() => {
    async function finish(storedEmail: string) {
      try {
        const auth = await firebaseBrowserAuth();
        if (!isSignInWithEmailLink(auth, window.location.href)) throw new Error("This sign-in link is invalid or expired.");
        const credential = await signInWithEmailLink(auth, storedEmail, window.location.href);
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
    const storedEmail = window.localStorage.getItem("storyglow-email");
    if (storedEmail) {
      void finish(storedEmail);
    } else {
      setMessage("Confirm the email address that received this sign-in link.");
      setNeedsEmail(true);
    }
  }, [router]);

  async function finishCrossDevice(event: React.FormEvent) {
    event.preventDefault();
    setNeedsEmail(false);
    setMessage("Finishing your secure sign-in...");
    try {
      const auth = await firebaseBrowserAuth();
      if (!isSignInWithEmailLink(auth, window.location.href)) throw new Error("This sign-in link is invalid or expired.");
      const credential = await signInWithEmailLink(auth, email, window.location.href);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, marketingOptIn: false, source: "email_signin" }),
      });
      if (!response.ok) throw new Error("Could not create your StoryGlow session.");
      router.replace("/create");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
      setNeedsEmail(true);
    }
  }

  return (
    <main className="page-content">
      <section className="auth-panel">
        <h1>StoryGlow</h1>
        <p role="status">{message}</p>
        {needsEmail ? (
          <form onSubmit={finishCrossDevice}>
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <button className="button full">Continue securely</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
