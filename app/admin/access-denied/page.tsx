import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getOptionalUser } from "@/lib/auth";

export default async function AdminAccessDeniedPage() {
  const user = await getOptionalUser();
  return (
    <>
      <SiteHeader />
      <main className="page-content">
        <div className="empty-state">
          <p className="section-label">Admin access</p>
          <h1>Admin access not enabled</h1>
          <p>
            {user?.email
              ? `${user.email} is signed in, but it is not listed in STORYGLOW_ADMIN_EMAILS yet.`
              : "Please sign in with the founder/admin email first."}
          </p>
          <p>
            Add the verified founder email to <code>STORYGLOW_ADMIN_EMAILS</code>, then sign in again with magic link or Google.
          </p>
          <Link className="button" href="/signin?next=/admin">Sign in as admin</Link>
        </div>
      </main>
    </>
  );
}
