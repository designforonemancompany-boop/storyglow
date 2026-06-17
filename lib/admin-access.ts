import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

function configuredAdminEmails() {
  return (process.env.STORYGLOW_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | undefined, verified = false) {
  const normalized = email?.toLowerCase();
  const allowed = configuredAdminEmails();
  return Boolean(normalized && verified && allowed.includes(normalized));
}

export async function requireAdminUser() {
  const user = await requireUser();
  if (!isAdminEmail(user.email, user.email_verified)) {
    redirect("/library");
  }
  return user;
}

export function hasAdminAllowlist() {
  return configuredAdminEmails().length > 0;
}
