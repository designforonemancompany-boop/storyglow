import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SignInForm } from "@/components/sign-in-form";
import { getOptionalUser } from "@/lib/auth";

export default async function SignInPage() {
  const user = await getOptionalUser();
  if (user) redirect("/library");
  return <><SiteHeader /><main className="page-content"><SignInForm /></main></>;
}
