"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function StoryGenerationStatus({
  status,
  title,
  errorStage,
}: {
  status: "generating" | "failed";
  title: string;
  errorStage?: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "generating") return;
    const timer = window.setInterval(() => router.refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [router, status]);

  return (
    <main className="page-content status-page">
      <p className="section-label">{status === "generating" ? "Illustrating your book" : "Generation needs a retry"}</p>
      <h1>{status === "generating" ? "Your StoryGlow book is being created" : "Your story did not finish"}</h1>
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
          <span>Designing characters</span>
          <span>Painting pages</span>
        </div>
      ) : null}
      <div className="form-footer">
        <Link className="button" href="/library">Back to My Stories</Link>
        {status === "generating" ? <span>Usually ready in about 2 minutes.</span> : <Link className="text-button" href="/create">Try again</Link>}
      </div>
    </main>
  );
}
