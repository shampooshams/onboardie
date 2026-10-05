import type { MessageKey } from "./en";

/** Maps Supabase's English auth errors to translated messages; unknown ones pass through. */
export function authErrorKey(message: string): MessageKey | null {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "auth.err.invalidLogin";
  if (m.includes("email not confirmed")) return "auth.err.notConfirmed";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "auth.err.alreadyRegistered";
  if (m.includes("password should be at least") || m.includes("weak password"))
    return "auth.err.weakPassword";
  if (m.includes("rate limit") || m.includes("too many requests")) return "auth.err.rateLimit";
  return null;
}
