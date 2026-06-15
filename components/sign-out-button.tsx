"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { firebaseBrowserAuth } from "@/lib/firebase/browser";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button className="text-button" onClick={async () => {
      const auth = await firebaseBrowserAuth();
      await Promise.all([
        signOut(auth),
        fetch("/api/auth/session", { method: "DELETE" }),
      ]);
      router.push("/");
      router.refresh();
    }}>Sign out</button>
  );
}
