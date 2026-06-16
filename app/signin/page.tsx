import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SignInForm } from "@/components/sign-in-form";
import { getOptionalUser } from "@/lib/auth";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getOptionalUser();
  if (user) redirect("/library");
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/library";
  return <><SiteHeader /><main className="page-content"><SignInForm nextPath={nextPath} /></main></>;
}
