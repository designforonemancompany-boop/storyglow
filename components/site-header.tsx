import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export async function SiteHeader() {
  const user = await getOptionalUser();
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden>✦</span> StoryGlow
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/#how">How it works</Link>
        <Link href="/sample">Sample story</Link>
        {user ? <><Link href="/library">My stories</Link><Link href="/settings">Settings</Link></> : <Link href="/signin">Sign in</Link>}
        {user ? <SignOutButton /> : null}
        <Link className="button button-small" href="/create">Create a story</Link>
      </nav>
    </header>
  );
}
