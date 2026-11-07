/**
 * Emails listed here get the top plan ("business") automatically after they log in.
 * Add or remove emails and push to GitHub; Vercel redeploys.
 *
 * You can also add more without touching code: set PREMIUM_EMAILS="a@x.com,b@y.com" in Vercel.
 *
 * SECURITY: these only unlock if the email is VERIFIED (Supabase "Confirm email" must be ON),
 * otherwise anyone could sign up with someone else's address.
 */
export const PREMIUM_EMAILS: string[] = [
  // "you@gmail.com",
  // "friend@gmail.com",
];

export function isPremiumEmail(email?: string | null): boolean {
  if (!email) return false;
  const fromEnv = (process.env.PREMIUM_EMAILS ?? "").split(",");
  const all = [...PREMIUM_EMAILS, ...fromEnv].map((e) => e.trim().toLowerCase()).filter(Boolean);
  return all.includes(email.trim().toLowerCase());
}
