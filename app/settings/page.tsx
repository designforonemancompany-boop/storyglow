import { SiteHeader } from "@/components/site-header";
import { PreferencesForm } from "@/components/preferences-form";
import { requireUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase/admin";

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await firestore().collection("profiles").doc(user.uid).get();
  return <><SiteHeader /><main className="page-content"><p className="section-label">Account</p><h1>Settings</h1><PreferencesForm initialValue={Boolean(profile.data()?.marketingOptIn)} /></main></>;
}
