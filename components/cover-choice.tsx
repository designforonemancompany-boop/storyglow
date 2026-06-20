"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type CoverChoiceOption = {
  id: string;
  label: string;
  promptSummary: string;
  imageUrl: string | null;
  status: string;
};

export function CoverChoice({
  storyId,
  title,
  dedication,
  status,
  options,
}: {
  storyId: string;
  title: string;
  dedication: string;
  status?: string | null;
  options: CoverChoiceOption[];
}) {
  const router = useRouter();
  const [busyOption, setBusyOption] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status !== "generating" && status !== "not_started") return;
    const timer = window.setInterval(() => router.refresh(), 7000);
    return () => window.clearInterval(timer);
  }, [router, status]);

  async function choose(optionId: string) {
    setBusyOption(optionId);
    setMessage("");
    try {
      const response = await fetch(`/api/stories/${storyId}/cover-options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not choose this cover.");
      setMessage("Cover selected. Painting the inside pages now...");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not choose this cover.");
      setBusyOption("");
    }
  }

  return (
    <main className="page-content cover-choice-page">
      <p className="section-label">Choose the book cover</p>
      <h1>{title}</h1>
      {dedication ? <p className="cover-choice-dedication">{dedication}</p> : null}
      <p>Pick the cover direction you love most. StoryGlow will use that art style as the guide for every inside page.</p>
      {status === "generating" || !options.length ? (
        <div className="empty-state">
          <h2>Painting three cover ideas</h2>
          <p>Your story text is already saved. The cover choices will appear here automatically. You can start reading while StoryGlow finishes painting.</p>
          <div className="cover-choice-actions">
            <Link className="button" href={`/stories/${storyId}?read=1`}>Read story text now</Link>
            <Link className="text-button" href="/library">Back to My Stories</Link>
          </div>
        </div>
      ) : status === "needs_retry" ? (
        <div className="empty-state">
          <h2>Cover choices need another try</h2>
          <p>The story is readable, but the cover-choice images did not finish. We can add a retry button next, but your credit and story text are safe.</p>
          <Link className="button" href={`/stories/${storyId}?read=1`}>Open readable story</Link>
        </div>
      ) : (
        <div className="cover-choice-grid">
          {options.map(option => (
            <article className="cover-choice-card" key={option.id}>
              <div className="cover-choice-image">
                {option.imageUrl ? <Image src={option.imageUrl} fill sizes="(max-width:850px) 100vw, 33vw" alt="" unoptimized /> : <div className="storybook-placeholder"><span>SG</span></div>}
              </div>
              <div className="cover-choice-copy">
                <span className="status-pill">{option.label}</span>
                <h2>{option.label}</h2>
                <p>{option.promptSummary}</p>
                <button className="button full" type="button" disabled={Boolean(busyOption)} onClick={() => void choose(option.id)}>
                  {busyOption === option.id ? "Choosing this cover..." : "Choose this cover"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </main>
  );
}
