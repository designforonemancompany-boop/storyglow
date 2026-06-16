import { SiteHeader } from "@/components/site-header";
import { PreferencesForm } from "@/components/preferences-form";
import { CharacterRefinementForm } from "@/components/character-refinement-form";
import { requireUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase/admin";
import { ownedFamilyCharacters } from "@/lib/firestore-data";

export default async function SettingsPage() {
  const user = await requireUser();
  const [profile, characters] = await Promise.all([
    firestore().collection("profiles").doc(user.uid).get(),
    ownedFamilyCharacters(user.uid),
  ]);
  return (
    <>
      <SiteHeader />
      <main className="page-content settings-stack">
        <section>
          <p className="section-label">Account</p>
          <h1>Settings</h1>
          <PreferencesForm initialValue={Boolean(profile.data()?.marketingOptIn)} />
        </section>
        <CharacterRefinementForm characters={characters} />
      </main>
    </>
  );
}
