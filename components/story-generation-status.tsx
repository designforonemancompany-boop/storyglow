"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function StoryGenerationStatus({
  status,
  title,
  errorStage,
  storyId,
}: {
  status: "generating" | "failed";
  title: string;
  errorStage?: string | null;
  storyId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status !== "generating") return;
    const timer = window.setInterval(() => router.refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [router, status]);

  async function recoverStory() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recover_story_text" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not recover this story.");
      setMessage("Story text recovered. Opening the reader...");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not recover this story.");
      setBusy(false);
    }
  }

  return (
    <main className="page-content status-page">
      <p className="section-label">{status === "generating" ? "Preparing your book" : "Generation needs a retry"}</p>
      <h1>{status === "generating" ? "Your StoryGlow book is being prepared" : "Your story did not finish"}</h1>
      <p>
        {status === "generating"
          ? `${title} is safely saved in your library. You can leave this page open; it will refresh automatically when the story is ready.`
          : "The credit was returned to your account. Please try creating the story again from your library."}
      </p>
      {status === "failed" && errorStage ? (
        <p className="privacy-note">Support reference: generation stopped during {errorStage.replaceAll("_", " ")}.</p>
      ) : null}
      {status === "generating" ? (
        <div className="generation-steps" aria-label="Story generation progress">
          <span>Writing the story</span>
          <span>Painting cover choices</span>
          <span>Waiting for your cover pick</span>
        </div>
      ) : null}
      <div className="form-footer">
        <Link className="button" href="/library">Back to My Stories</Link>
        {status === "generating" ? <span>The story text saves first, then cover choices appear automatically.</span> : (
          errorStage === "story_text_result"
            ? <button className="button" type="button" onClick={recoverStory} disabled={busy}>{busy ? "Recovering..." : "Recover this story"}</button>
            : <Link className="text-button" href="/create">Try again</Link>
        )}
      </div>
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </main>
  );
}
