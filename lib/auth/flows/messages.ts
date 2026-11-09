/**
 * User-facing copy for auth flows. Keep these generic: they must never reveal
 * whether an email address has an account.
 */
export const MESSAGES = {
  tooManyAttempts: "Too many attempts. Please try again later.",
  invalidLink: "This link is invalid or has expired. Request a new one to continue.",
  forgotSent:
    "If an account exists for that email, we've sent a link to reset your password. Check your inbox and spam folder.",
  resendSent:
    "If an account exists for that email and still needs verifying, we've sent a new link. Check your inbox and spam folder.",
  invalidCode: "That code is invalid or has expired. Request a new code and try again.",
  genericError: "Something went wrong. Please try again.",
} as const;
