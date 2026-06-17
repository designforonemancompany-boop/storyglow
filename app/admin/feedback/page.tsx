import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { hasAdminAllowlist, requireAdminUser } from "@/lib/admin-access";
import { firestore } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

function iso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return "";
}

function formatDate(value: string) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export default async function AdminFeedbackPage() {
  await requireAdminUser();
  const configured = hasAdminAllowlist();
  const feedbackSnapshot = await firestore()
    .collection("userFeedback")
    .orderBy("created_at", "desc")
    .limit(50)
    .get();

  const reviewDocs = await Promise.all(feedbackSnapshot.docs.map(doc =>
    firestore().collection("feedbackReviews").doc(doc.id).get().catch(() => null),
  ));

  const rows = feedbackSnapshot.docs.map((doc, index) => {
    const data = doc.data();
    const review = reviewDocs[index]?.exists ? reviewDocs[index]?.data() : null;
    return {
      id: doc.id,
      createdAt: iso(data.created_at),
      kind: String(data.kind || "feedback"),
      audioCadence: String(data.audio_cadence || "not captured").replaceAll("_", " "),
      storyId: data.story_id ? String(data.story_id) : "",
      pageUrl: data.page_url ? String(data.page_url) : "",
      rewardCredits: Number(data.reward_credits || 0),
      message: String(data.message || ""),
      priority: review?.priority ? String(review.priority) : "unreviewed",
      status: review?.status ? String(review.status).replaceAll("_", " ") : "no review record",
      proposedSolution: review?.proposed_solution ? String(review.proposed_solution) : "",
    };
  });

  return (
    <>
      <SiteHeader />
      <main className="page-content admin-feedback-page">
        <p className="section-label">Admin</p>
        <h1>Feedback Inbox</h1>
        <p>Latest full beta comments from Firestore. Times are shown in Asia/Shanghai.</p>
        {!configured ? (
          <div className="empty-state">
            <h2>Admin email allowlist missing</h2>
            <p>Set <code>STORYGLOW_ADMIN_EMAILS</code> to a comma-separated list of verified admin emails.</p>
          </div>
        ) : null}
        {rows.length ? (
          <div className="feedback-list">
            {rows.map(row => (
              <article key={row.id} className="feedback-card">
                <div className="feedback-card-top">
                  <div>
                    <span className="status-pill">{row.priority}</span>
                    <h2>{row.kind.replaceAll("_", " ")}</h2>
                  </div>
                  <time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time>
                </div>
                <p className="feedback-comment">{row.message}</p>
                <dl className="feedback-meta">
                  <div><dt>Status</dt><dd>{row.status}</dd></div>
                  <div><dt>Audio cadence</dt><dd>{row.audioCadence}</dd></div>
                  <div><dt>Reward</dt><dd>{row.rewardCredits} credits</dd></div>
                  {row.storyId ? <div><dt>Story ID</dt><dd>{row.storyId}</dd></div> : null}
                  {row.pageUrl ? <div><dt>Page</dt><dd><Link href={row.pageUrl}>{row.pageUrl}</Link></dd></div> : null}
                </dl>
                {row.proposedSolution ? (
                  <div className="feedback-solution">
                    <strong>Proposed solution</strong>
                    <p>{row.proposedSolution}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No feedback yet</h2>
            <p>New bug reports, ideas, and story feedback will appear here after submission.</p>
          </div>
        )}
      </main>
    </>
  );
}
