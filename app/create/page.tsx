import { SiteHeader } from "@/components/site-header";
import { CreateStoryForm } from "@/components/create-story-form";
import { getOptionalUser } from "@/lib/auth";

export default async function CreatePage() {
  const user = await getOptionalUser();
  return (
    <>
      <SiteHeader />
      <main className="page-content creation-grid">
        <aside className="creation-aside">
          <p className="section-label">Your family&apos;s book</p>
          <h1>What memory should their story hold?</h1>
          <p>StoryGlow drafts three age-matched storylines first. Pick the one you love, choose an illustration style, then let the book finish quietly in My Stories.</p>
        </aside>
        <CreateStoryForm isSignedIn={Boolean(user)} />
      </main>
    </>
  );
}