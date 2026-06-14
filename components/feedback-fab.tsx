"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type Cadence = "too_fast" | "just_right" | "too_slow";

const cadenceOptions: { value: Cadence; emoji: string; label: string }[] = [
  { value: "too_fast", emoji: "⏩", label: "Too Fast" },
  { value: "just_right", emoji: "😊", label: "Just Right" },
  { value: "too_slow", emoji: "🐢", label: "Too Slow" },
];

export function FeedbackFab() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cadence, setCadence] = useState<Cadence | null>(null);
  const [kind, setKind] = useState<"bug" | "idea" | "story_feedback">("idea");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const storyMatch = pathname.match(/^\/stories\/([^/]+)$/i);
  const storyId = storyMatch?.[1] || null;

  function close() {
    setOpen(false);
    setCadence(null);
    setMessage("");
    setStatus("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!cadence) return;
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId,
        kind,
        audioCadence: cadence,
        message,
        pageUrl: location.href,
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (response.status === 401) {
      sessionStorage.setItem("storyglow-feedback-return", pathname);
      router.push("/signin");
      return;
    }
    if (!response.ok) {
      setStatus(result.error || "Feedback could not be sent.");
      return;
    }
    setStatus(result.rewardCredits
      ? `Thank you — ${result.rewardCredits} premium credit${result.rewardCredits === 1 ? "" : "s"} added.`
      : "Thank you — your feedback is with the StoryGlow team.");
    window.setTimeout(close, 2400);
  }

  return (
    <>
      <button className="feedback-fab" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Report Bug or Idea">
        <span aria-hidden>✦</span><span className="feedback-label">Report Bug / Idea</span>
      </button>
      {open ? (
        <div className="feedback-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) close();
        }}>
          <section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
            <button className="feedback-close" onClick={close} aria-label="Close feedback">×</button>
            <p className="section-label">Help shape StoryGlow</p>
            <h2 id="feedback-title">How was the bedtime audio cadence?</h2>
            <div className="sentiment-options" role="radiogroup" aria-label="Audio cadence">
              {cadenceOptions.map(option => (
                <button key={option.value} className={cadence === option.value ? "selected" : ""} onClick={() => setCadence(option.value)} role="radio" aria-checked={cadence === option.value}>
                  <span aria-hidden>{option.emoji}</span>{option.label}
                </button>
              ))}
            </div>
            {cadence ? (
              <form onSubmit={submit}>
                <label>What would you like to share?
                  <select value={kind} onChange={event => setKind(event.target.value as typeof kind)}>
                    <option value="bug">Report a bug</option>
                    <option value="idea">Share an idea</option>
                    <option value="story_feedback">Story feedback</option>
                  </select>
                </label>
                <label>Details<textarea value={message} onChange={event => setMessage(event.target.value)} minLength={3} maxLength={2000} required placeholder="Tell us what happened or what would make bedtime better…" /></label>
                <button className="button full" disabled={busy}>{busy ? "Sending…" : "Send feedback"}</button>
              </form>
            ) : <p>Choose one option to continue.</p>}
            <p className="form-message" role="status">{status}</p>
          </section>
        </div>
      ) : null}
    </>
  );
}
