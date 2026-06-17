import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

function configuredAdminEmails() {
  return (process.env.STORYGLOW_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdminUser() {
  const user = await requireUser();
  const email = user.email?.toLowerCase();
  const allowed = configuredAdminEmails();
  if (!email || !user.email_verified || !allowed.includes(email)) {
    redirect("/library");
  }
  return user;
}

export function hasAdminAllowlist() {
  return configuredAdminEmails().length > 0;
}
