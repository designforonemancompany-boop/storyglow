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
          <p>StoryGlow uses Google AI Studio to write an age-matched story and create cohesive, non-photorealistic watercolor illustrations.</p>
        </aside>
        <CreateStoryForm isSignedIn={Boolean(user)} />
      </main>
    </>
  );
}
