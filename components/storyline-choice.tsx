"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type StorylineChoiceOption = {
  id: string;
  label: string;
  title: string;
  hook: string;
  tone: string;
};

export function StorylineChoice({
  storyId,
  options,
}: {
  storyId: string;
  options: StorylineChoiceOption[];
}) {
  const router = useRouter();
  const [busyOption, setBusyOption] = useState("");
  const [message, setMessage] = useState("");

  async function choose(optionId: string) {
    setBusyOption(optionId);
    setMessage("");
    try {
      const response = await fetch(`/api/stories/${storyId}/storyline-options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not choose this storyline.");
      setMessage("Storyline selected. Preparing three illustration styles now...");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not choose this storyline.");
      setBusyOption("");
    }
  }

  return (
    <main className="page-content storyline-choice-page">
      <p className="section-label">Choose the storyline</p>
      <h1>Pick the story your family wants to keep</h1>
      <p>StoryGlow drafted three different bedtime directions from the same memory. Choose one first, then we will paint three illustration styles for that story.</p>
      {options.length ? (
        <div className="storyline-choice-grid">
          {options.map(option => (
            <article className="storyline-choice-card" key={option.id}>
              <span className="status-pill">{option.label}</span>
              <h2>{option.title}</h2>
              <p>{option.hook}</p>
              <small>{option.tone}</small>
              <button className="button full" type="button" disabled={Boolean(busyOption)} onClick={() => void choose(option.id)}>
                {busyOption === option.id ? "Choosing this storyline..." : "Choose this storyline"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Writing three storylines</h2>
          <p>Your story choices will appear automatically. No rush - the book is saved in your library.</p>
        </div>
      )}
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </main>
  );
}
