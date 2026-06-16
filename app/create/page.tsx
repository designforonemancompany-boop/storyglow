import { SiteHeader } from "@/components/site-header";
import { CreateStoryForm } from "@/components/create-story-form";
import { getOptionalUser } from "@/lib/auth";
import { ownedFamilyCharacters } from "@/lib/firestore-data";

export default async function CreatePage() {
  const user = await getOptionalUser();
  const reusableCharacters = user ? await ownedFamilyCharacters(user.uid) : [];
  return (
    <>
      <SiteHeader />
      <main className="page-content creation-grid">
        <aside className="creation-aside">
          <p className="section-label">Your family&apos;s book</p>
          <h1>What memory should their story hold?</h1>
          <p>StoryGlow writes an age-matched story, creates a dedicated cover, and keeps family characters visually consistent across future books.</p>
        </aside>
        <CreateStoryForm isSignedIn={Boolean(user)} reusableCharacterCount={reusableCharacters.length} />
      </main>
    </>
  );
}
