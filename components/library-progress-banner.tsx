"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LibraryProgressBanner({
  status,
  completedPages,
  totalPages,
}: {
  status?: string | null;
  completedPages: number;
  totalPages: number;
}) {
  const router = useRouter();
  const percentage = totalPages > 0 ? Math.round(completedPages / totalPages * 100) : 8;
  const clamped = Math.max(status === "ready" ? 100 : 8, Math.min(100, percentage));
  const stillWorking = status === "generating" || status === "awaiting_cover_choice" || !status;

  useEffect(() => {
    if (!stillWorking) return;
    const timer = window.setInterval(() => router.refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [router, stillWorking]);

  const message = status === "needs_retry"
    ? "Some pages need another illustration pass. Open the story to retry only the page that needs fixing."
    : status === "ready"
      ? "Your storybook is ready to read and listen to."
      : totalPages > 0
        ? `Painting page illustrations: ${completedPages} of ${totalPages} pages finished.`
        : "StoryGlow is preparing the book structure. The first progress update will appear automatically.";

  return (
    <div className="library-progress-banner" role="status">
      <strong>{status === "ready" ? "Your storybook is ready" : "Your storybook is being created"}</strong>
      <span>{message}</span>
      <div className="progress-track determinate" aria-label={`Book creation ${clamped}% complete`}>
        <span style={{ width: `${clamped}%` }} />
      </div>
      <small>{stillWorking ? "This page refreshes automatically every few seconds." : "Progress saved."}</small>
    </div>
  );
}
