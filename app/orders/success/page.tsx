import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import { firestore } from "@/lib/firebase/admin";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const user = await requireUser();
  const { session_id: sessionId } = await searchParams;
  const checkout = sessionId
    ? await firestore().collection("checkoutSessions").doc(sessionId).get()
    : null;
  const belongsToUser = checkout?.exists && checkout.data()?.owner_id === user.uid;

  return (
    <>
      <SiteHeader />
      <main className="page-content">
        <section className="order-success">
          <p className="section-label">Payment received</p>
          <h1>Your book order is in.</h1>
          <p>
            {belongsToUser
              ? "We are confirming the payment and preparing your personalized book for production. Its status will appear in My Stories."
              : "Return to My Stories to review your private books and orders."}
          </p>
          <Link className="button" href="/library">Go to My Stories</Link>
        </section>
      </main>
    </>
  );
}

