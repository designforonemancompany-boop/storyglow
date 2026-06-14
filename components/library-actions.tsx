"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LibraryActions({ storyId }: { storyId: string }) {
  const router = useRouter();
  const [shareUrl, setShareUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    const response = await fetch(`/api/stories/${storyId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInDays: 30 }),
    });
    const result = await response.json();
    setBusy(false);
    if (response.ok) setShareUrl(result.url);
  }

  async function remove() {
    if (!window.confirm("Permanently delete this story, its audio, illustrations, and sharing links?")) return;
    setBusy(true);
    const response = await fetch(`/api/stories/${storyId}`, { method: "DELETE" });
    setBusy(false);
    if (response.ok) router.refresh();
  }

  return (
    <>
      <div className="library-card-actions">
        <button className="text-button" disabled={busy} onClick={share}>Share privately</button>
        <button className="text-button danger-text" disabled={busy} onClick={remove}>Delete</button>
      </div>
      {shareUrl ? <div className="share-box"><strong>Private link</strong><p>{shareUrl}</p><button className="text-button" onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy link</button></div> : null}
    </>
  );
}
