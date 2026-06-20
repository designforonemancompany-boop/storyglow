import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { LibraryActions } from "@/components/library-actions";
import { LibraryProgressBanner } from "@/components/library-progress-banner";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { firestore } from "@/lib/firebase/admin";
import { storyFromDoc } from "@/lib/firestore-data";
import { signMediaPath } from "@/lib/media";
import type { PrintOrderRecord } from "@/lib/types";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ creating?: string }>;
}) {
  const search = await searchParams;
  const creatingStoryId = search?.creating || "";
  const user = await requireUser();
  const db = firestore();
  const env = serverEnv();
  const [storiesSnapshot, profile, ordersSnapshot] = await Promise.all([
    db.collection("stories").where("owner_id", "==", user.uid).get(),
    db.collection("profiles").doc(user.uid).get(),
    db.collection("printOrders").where("owner_id", "==", user.uid).get(),
  ]);
  const stories = storiesSnapshot.docs.map(storyFromDoc)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const cards = await Promise.all(stories.map(async story => {
    const pagesSnapshot = await db.collection("stories").doc(story.id).collection("pages").get();
    const totalPages = pagesSnapshot.size;
    const completedPages = pagesSnapshot.docs.filter(doc => Boolean(doc.data().illustration_path)).length;
    return {
      ...story,
      coverUrl: await signMediaPath(story.cover_path),
      totalPages,
      completedPages,
    };
  }));
  const orders = ordersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as PrintOrderRecord[];
  const physicalBookPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(env.PHYSICAL_BOOK_PRICE_CENTS / 100);

  return (
    <>
      <SiteHeader />
      <main className="page-content">
        <p className="section-label">Your private library</p>
        <h1>My Stories</h1>
        <p>Open your books on any phone, continue listening, or share a revocable private link.</p>
        {creatingStoryId ? (() => {
          const creatingStory = cards.find(story => story.id === creatingStoryId);
          return <LibraryProgressBanner
            status={creatingStory?.media_generation_status || null}
            completedPages={creatingStory?.completedPages || 0}
            totalPages={creatingStory?.totalPages || 0}
          />;
        })() : null}
        <p className="credit-balance"><strong>{profile.data()?.storybookCredits || 0}</strong> premium storybook credits</p>
        {cards.length ? (
          <div className="story-grid">
            {cards.map(story => (
              <article className="library-card" key={story.id}>
                {story.coverUrl ? (
                  <Image src={story.coverUrl} width={720} height={450} alt="" unoptimized />
                ) : (
                  <div className="library-cover-fallback">
                    <div className="storybook-placeholder" aria-hidden><span>SG</span></div>
                    <span>{story.cover_choice_status === "ready" ? "Choose your cover" : "Illustration pending"}</span>
                  </div>
                )}
                <div className="library-card-body">
                  <span className="status-pill">{story.status}</span>
                  <h2>{story.title}</h2>
                  <p>{story.dedication || "A private StoryGlow book."}</p>
                  <div className="snapshot-meta">
                    <span>Story snapshot</span>
                    <strong>{story.brief?.event || "A family memory"}</strong>
                    {story.storyline_choice_status !== "selected" ? <small>Choose from 3 storyline directions</small> : story.cover_choice_status === "ready" ? <small>Choose from 3 illustration styles</small> : story.media_generation_status === "generating" ? <small>Painting pages: {story.completedPages} of {story.totalPages || "?"}</small> : story.media_generation_status === "needs_retry" ? <small>Some page art needs retry</small> : <small>Saved storybook</small>}
                  </div>
                  {story.status === "ready" || story.status === "archived" ? <Link className="button" href={`/stories/${story.id}`}>{story.storyline_choice_status !== "selected" ? "Choose storyline" : story.cover_choice_status === "ready" ? "Choose illustration style" : "Read or listen"}</Link> : null}
                  {story.status === "generating" ? <Link className="button" href={`/stories/${story.id}`}>View progress</Link> : null}
                  {story.status === "failed" ? <Link className="button" href={`/stories/${story.id}`}>See retry details</Link> : null}
                  <LibraryActions
                    storyId={story.id}
                    archived={story.status === "archived"}
                    checkoutEnabled={Boolean(env.STRIPE_SECRET_KEY)}
                    physicalBookPrice={physicalBookPrice}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><h2>Your first story is waiting</h2><p>Start with a name, a memory, and one detail worth keeping.</p><Link className="button" href="/create">Create a story</Link></div>
        )}
        {orders.length ? (
          <section className="orders-section">
            <p className="section-label">Physical books</p>
            <h2>Your orders</h2>
            <div className="order-list">
              {orders.map(order => (
                <article key={order.id}>
                  <strong>Personalized hardcover</strong>
                  <span>{String(order.fulfillment_status || "processing").replaceAll("_", " ")}</span>
                  <small>{order.currency ? `${String(order.currency).toUpperCase()} ${((Number(order.amount_total) || 0) / 100).toFixed(2)}` : ""}</small>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
