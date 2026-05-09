import type { User } from "@supabase/supabase-js";

// Single source of truth for who is allowed into the management app.
// Add additional admin emails here if you ever onboard another owner.
export const ADMIN_EMAILS: readonly string[] = [
  "munroe.jayden20@gmail.com",
];

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  if (!e) return false;
  return ADMIN_EMAILS.some((allowed) => allowed.toLowerCase() === e);
}

export function isAdminUser(user: User | null | undefined): boolean {
  return isAdminEmail(user?.email);
}
