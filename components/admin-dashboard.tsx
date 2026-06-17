"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type FeedbackRow = {
  id: string;
  userId: string;
  userEmail: string;
  createdAt: string;
  kind: string;
  audioCadence: string;
  storyId: string;
  pageUrl: string;
  rewardCredits: number;
  message: string;
  review: {
    status: string;
    priority: string;
    proposedSolution: string;
    internalNotes: string;
    resolutionNotes: string;
    reviewedAt: string;
    reviewedBy: string;
  };
};

type UserLookup = {
  uid: string;
  email: string;
  displayName: string;
  storybookCredits: number;
  freeStoriesUsed: number;
};

const REVIEW_STATUSES = ["new", "reviewing", "planned", "fixed", "closed"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

function formatDate(value: string) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export function AdminDashboard({ feedback }: { feedback: FeedbackRow[] }) {
  const [rows, setRows] = useState(feedback);
  const [lookup, setLookup] = useState("");
  const [user, setUser] = useState<UserLookup | null>(null);
  const [creditDelta, setCreditDelta] = useState("1");
  const [creditReason, setCreditReason] = useState("");
  const [message, setMessage] = useState("");

  async function updateReview(row: FeedbackRow, formData: FormData) {
    setMessage("Saving review...");
    const response = await fetch("/api/admin/feedback/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedbackId: row.id,
        status: formData.get("status"),
        priority: formData.get("priority"),
        proposedSolution: formData.get("proposedSolution"),
        internalNotes: formData.get("internalNotes"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Could not save review.");
      return;
    }
    setRows(current => current.map(item => item.id === row.id ? {
      ...item,
      review: {
        ...item.review,
        status: payload.review.status,
        priority: payload.review.priority,
        proposedSolution: payload.review.proposed_solution || "",
        internalNotes: payload.review.internal_notes || "",
        reviewedAt: payload.review.reviewed_at || "",
        reviewedBy: payload.review.reviewed_by || "",
      },
    } : item));
    setMessage("Review saved.");
  }

  async function findUser(event: FormEvent) {
    event.preventDefault();
    setMessage("Searching user...");
    setUser(null);
    const key = lookup.includes("@") ? "email" : "uid";
    const response = await fetch(`/api/admin/users?${key}=${encodeURIComponent(lookup.trim())}`);
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "User not found.");
      return;
    }
    setUser(payload.user);
    setMessage("User found.");
  }

  async function adjustCredits(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setMessage("Updating credits...");
    const response = await fetch("/api/admin/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.uid,
        delta: Number(creditDelta),
        reason: creditReason,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Could not update credits.");
      return;
    }
    setUser({ ...user, storybookCredits: payload.storybookCredits });
    setCreditReason("");
    setMessage(`Credits updated. New balance: ${payload.storybookCredits}.`);
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel">
        <p className="section-label">Manual credits</p>
        <h2>Find a parent account</h2>
        <form className="admin-form" onSubmit={findUser}>
          <label>
            Email or UID
            <input value={lookup} onChange={event => setLookup(event.target.value)} placeholder="parent@example.com" required />
          </label>
          <button className="button" type="submit">Search user</button>
        </form>
        {user ? (
          <div className="admin-user-card">
            <strong>{user.email || user.uid}</strong>
            <span>{user.displayName || "No display name"}</span>
            <p><b>{user.storybookCredits}</b> premium credits</p>
            <form className="admin-form" onSubmit={adjustCredits}>
              <label>
                Credit change
                <input type="number" min="-20" max="20" value={creditDelta} onChange={event => setCreditDelta(event.target.value)} required />
              </label>
              <label>
                Admin reason
                <textarea value={creditReason} onChange={event => setCreditReason(event.target.value)} minLength={8} maxLength={500} placeholder="Beta support credit after reported generation issue." required />
              </label>
              <button className="button" type="submit">Apply credit change</button>
            </form>
          </div>
        ) : null}
        {message ? <p className="admin-message">{message}</p> : null}
      </section>

      <section className="admin-panel admin-feedback-wide">
        <p className="section-label">Feedback review</p>
        <h2>Latest full comments</h2>
        {rows.length ? (
          <div className="feedback-list">
            {rows.map(row => (
              <article key={row.id} className="feedback-card">
                <div className="feedback-card-top">
                  <div>
                    <span className="status-pill">{row.review.status}</span>
                    <h3>{row.kind.replaceAll("_", " ")}</h3>
                  </div>
                  <time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time>
                </div>
                <p className="feedback-comment">{row.message}</p>
                <dl className="feedback-meta">
                  <div><dt>User</dt><dd>{row.userEmail || row.userId || "Unknown"}</dd></div>
                  <div><dt>Audio cadence</dt><dd>{row.audioCadence.replaceAll("_", " ")}</dd></div>
                  <div><dt>Reward</dt><dd>{row.rewardCredits} credits</dd></div>
                  {row.storyId ? <div><dt>Story ID</dt><dd>{row.storyId}</dd></div> : null}
                  {row.pageUrl ? <div><dt>Page</dt><dd><a href={row.pageUrl}>{row.pageUrl}</a></dd></div> : null}
                </dl>
                <form className="review-form" action={formData => updateReview(row, formData)}>
                  <label>
                    Status
                    <select name="status" defaultValue={row.review.status}>
                      {REVIEW_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label>
                    Priority
                    <select name="priority" defaultValue={row.review.priority}>
                      {PRIORITIES.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                    </select>
                  </label>
                  <label>
                    Proposed solution
                    <textarea name="proposedSolution" defaultValue={row.review.proposedSolution} maxLength={1200} placeholder="What we will change or investigate next." />
                  </label>
                  <label>
                    Internal notes
                    <textarea name="internalNotes" defaultValue={row.review.internalNotes} maxLength={1200} placeholder="Private admin context." />
                  </label>
                  <button className="button button-small" type="submit">Save review</button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No feedback yet</h3>
            <p>New bug reports and ideas will appear here after submission.</p>
          </div>
        )}
      </section>
    </div>
  );
}
