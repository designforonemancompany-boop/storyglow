import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { AdminDashboard } from "@/components/admin-dashboard";
import { hasAdminAllowlist, requireAdminUser } from "@/lib/admin-access";
import { firestore } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

function iso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return "";
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export default async function AdminPage() {
  const admin = await requireAdminUser();
  const configured = hasAdminAllowlist();
  const db = firestore();
  const feedbackSnapshot = await db
    .collection("userFeedback")
    .orderBy("created_at", "desc")
    .limit(50)
    .get();

  const rows = await Promise.all(feedbackSnapshot.docs.map(async doc => {
    const data = doc.data();
    const [reviewDoc, profileDoc] = await Promise.all([
      db.collection("feedbackReviews").doc(doc.id).get().catch(() => null),
      data.user_id ? db.collection("profiles").doc(String(data.user_id)).get().catch(() => null) : null,
    ]);
    const profile = profileDoc?.exists ? profileDoc.data() : null;
    const review = reviewDoc?.exists ? reviewDoc.data() : null;
    return {
      id: doc.id,
      userId: stringValue(data.user_id),
      userEmail: stringValue(profile?.email),
      createdAt: iso(data.created_at),
      kind: stringValue(data.kind, "feedback"),
      audioCadence: stringValue(data.audio_cadence, "not_captured"),
      storyId: stringValue(data.story_id),
      pageUrl: stringValue(data.page_url),
      rewardCredits: Number(data.reward_credits || 0),
      message: stringValue(data.message),
      review: {
        status: stringValue(review?.status, "new"),
        priority: stringValue(review?.priority, "normal"),
        proposedSolution: stringValue(review?.proposed_solution),
        internalNotes: stringValue(review?.internal_notes),
        resolutionNotes: stringValue(review?.resolution_notes),
        reviewedAt: iso(review?.reviewed_at),
        reviewedBy: stringValue(review?.reviewed_by),
      },
    };
  }));

  return (
    <>
      <SiteHeader />
      <main className="page-content admin-feedback-page">
        <p className="section-label">Founder admin</p>
        <h1>StoryGlow Beta Control Room</h1>
        <p>
          Review every beta comment, propose a fix, and manually grant story credits while checkout is coming soon.
        </p>
        {!configured ? (
          <div className="empty-state">
            <h2>Admin email allowlist missing</h2>
            <p>Set <code>STORYGLOW_ADMIN_EMAILS</code> to your verified login email before using this dashboard.</p>
          </div>
        ) : null}
        <div className="admin-toolbar">
          <span>Signed in as {admin.email}</span>
          <Link className="text-button" href="/admin/feedback">Stable admin URL</Link>
        </div>
        <AdminDashboard feedback={rows} />
      </main>
    </>
  );
}
