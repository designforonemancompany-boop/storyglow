"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LibraryActionsProps = {
  storyId: string;
  archived: boolean;
  checkoutEnabled: boolean;
  physicalBookPrice: string;
};

export function LibraryActions({
  storyId,
  archived,
  checkoutEnabled,
  physicalBookPrice,
}: LibraryActionsProps) {
  const router = useRouter();
  const [shareUrl, setShareUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function requestAction(url: string, init: RequestInit, successMessage: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, init);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      setMessage(successMessage);
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const result = await requestAction(`/api/stories/${storyId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInDays: 30 }),
    }, "Private link created. It expires in 30 days.");
    if (result) setShareUrl(result.url);
  }

  async function revoke() {
    const result = await requestAction(
      `/api/stories/${storyId}/share`,
      { method: "DELETE" },
      "All private links for this story are now revoked.",
    );
    if (result) setShareUrl("");
  }

  async function orderPhysicalBook() {
    const result = await requestAction(
      `/api/stories/${storyId}/checkout`,
      { method: "POST" },
      "Opening secure checkout...",
    );
    if (result?.url) window.location.assign(result.url);
  }

  async function setArchived(nextArchived: boolean) {
    const result = await requestAction(`/api/stories/${storyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: nextArchived }),
    }, nextArchived ? "Story archived." : "Story restored.");
    if (result) router.refresh();
  }

  async function remove() {
    if (!window.confirm("Permanently delete this story, its audio, illustrations, and sharing links?")) return;
    const result = await requestAction(
      `/api/stories/${storyId}`,
      { method: "DELETE" },
      "Story deleted.",
    );
    if (result) router.refresh();
  }

  return (
    <>
      <div className="library-card-actions">
        <button className="button button-small" disabled={busy || !checkoutEnabled} onClick={orderPhysicalBook}>
          {checkoutEnabled ? `Order hardcover · ${physicalBookPrice}` : "Print checkout coming soon"}
        </button>
        {!archived ? <button className="text-button" disabled={busy} onClick={share}>Share privately</button> : null}
        <button className="text-button" disabled={busy} onClick={revoke}>Revoke links</button>
        <button className="text-button" disabled={busy} onClick={() => setArchived(!archived)}>
          {archived ? "Restore" : "Archive"}
        </button>
        <button className="text-button danger-text" disabled={busy} onClick={remove}>Delete</button>
      </div>
      {shareUrl ? <div className="share-box"><strong>Private link</strong><p>{shareUrl}</p><button className="text-button" onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy link</button></div> : null}
      {message ? <p className="action-message" role="status">{message}</p> : null}
    </>
  );
}
