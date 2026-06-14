import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { LibraryActions } from "@/components/library-actions";
import { requireUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase/admin";
import { storyFromDoc } from "@/lib/firestore-data";
import { signMediaPath } from "@/lib/media";

export default async function LibraryPage() {
  const user = await requireUser();
  const db = firestore();
  const [storiesSnapshot, profile] = await Promise.all([
    db.collection("stories").where("owner_id", "==", user.uid).get(),
    db.collection("profiles").doc(user.uid).get(),
  ]);
  const stories = storiesSnapshot.docs.map(storyFromDoc)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const cards = await Promise.all(stories.map(async story => ({
    ...story,
    coverUrl: await signMediaPath(story.cover_path),
  })));

  return (
    <>
      <SiteHeader />
      <main className="page-content">
        <p className="section-label">Your private library</p>
        <h1>My Stories</h1>
        <p>Open your books on any phone, continue listening, or share a revocable private link.</p>
        <p className="credit-balance"><strong>{profile.data()?.storybookCredits || 0}</strong> premium storybook credits</p>
        {cards.length ? (
          <div className="story-grid">
            {cards.map(story => (
              <article className="library-card" key={story.id}>
                <Image src={story.coverUrl || "/assets/birthday-story-scenes.png"} width={720} height={450} alt="" unoptimized={Boolean(story.coverUrl)} />
                <div className="library-card-body">
                  <span className="status-pill">{story.status}</span>
                  <h2>{story.title}</h2>
                  <p>{story.dedication || "A private StoryGlow book."}</p>
                  {story.status === "ready" ? <Link className="button" href={`/stories/${story.id}`}>Read or listen</Link> : null}
                  <LibraryActions storyId={story.id} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><h2>Your first story is waiting</h2><p>Start with a name, a memory, and one detail worth keeping.</p><Link className="button" href="/create">Create a story</Link></div>
        )}
      </main>
    </>
  );
}
