/**
 * Helpers for browser login against Supabase GoTrue (cloud or self-hosted).
 */

/** GoTrue stores emails normalized; trimming + lower case avoids typos breaking sign-in. */
export function normalizeLoginEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

type AuthLikeError = {
  message: string
  status?: number
  code?: string
}

/** Turn Supabase Auth errors into short, actionable copy for toast/UI. */
export function describeAuthSignInError(error: AuthLikeError | null): string {
  if (!error) return "Could not sign in. Please try again."
  const code = String(error.code ?? "").toLowerCase()
  const msg = (error.message || "").toLowerCase()

  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Confirm your email before signing in, or ask an admin to approve your account in Supabase Authentication."
  }
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "Incorrect email or password. Admins: set a login password under Users → Edit (same email as here)."
  }
  if (code === "user_banned" || msg.includes("banned")) {
    return "This account has been banned. Contact your administrator."
  }
  if (code === "too_many_requests" || msg.includes("rate limit")) {
    return "Too many attempts. Wait a minute and try again."
  }

  return error.message || "Sign-in failed."
}
