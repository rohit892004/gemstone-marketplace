/**
 * Email copy. Plain text only in M1. Keep links absolute (APP_URL based).
 * Templates return { subject, text }; senders call getEmailProvider().send().
 */

export interface Rendered {
  subject: string;
  text: string;
}

export const emailTemplates = {
  verifyEmail(name: string | null, url: string): Rendered {
    return {
      subject: "Verify your email for Gemstone Selections",
      text: `Hello${name ? ` ${name}` : ""},\n\nConfirm your email address to activate your account:\n${url}\n\nThis link expires in 24 hours and can be used once.\nIf you did not create an account, you can ignore this email.`,
    };
  },

  /** Sent instead of a verification link when someone registers with an address that already has an account. */
  accountExists(url: string): Rendered {
    return {
      subject: "Account already exists for this email",
      text: `Someone tried to create a Gemstone Selections account with this email address, but an account already exists.\n\nIf this was you, log in or reset your password:\n${url}\n\nIf this was not you, no action is needed.`,
    };
  },

  passwordReset(name: string | null, url: string): Rendered {
    return {
      subject: "Reset your Gemstone Selections password",
      text: `Hello${name ? ` ${name}` : ""},\n\nUse this link to set a new password:\n${url}\n\nThe link expires in 30 minutes and can be used once.\nIf you did not ask for a reset, you can ignore this email; your password has not changed.`,
    };
  },

  sellerApproved(name: string | null, loginUrl: string): Rendered {
    return {
      subject: "Your seller account is approved",
      text: `Hello${name ? ` ${name}` : ""},\n\nYour seller account has been approved. You can now manage your portfolio:\n${loginUrl}`,
    };
  },

  sellerRejected(name: string | null, reason: string): Rendered {
    return {
      subject: "Update on your seller application",
      text: `Hello${name ? ` ${name}` : ""},\n\nWe were unable to approve your seller application at this time.\n\nReason: ${reason}\n\nYou can correct the details and contact support to reapply.`,
    };
  },

  sellerSuspended(name: string | null, reason: string): Rendered {
    return {
      subject: "Your seller account has been suspended",
      text: `Hello${name ? ` ${name}` : ""},\n\nYour seller account has been suspended.\n\nReason: ${reason}\n\nContact support if you believe this is a mistake.`,
    };
  },
};
