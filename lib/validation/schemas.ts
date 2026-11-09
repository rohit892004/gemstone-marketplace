import { z } from "zod";

/**
 * Shared validation schemas. Every server action, route handler and form uses these
 * (or extends them) so rules are defined once. Feature-specific schemas live with their feature.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

/** Accepts "+91 98123 45678", "98123-45678" etc. Stored normalised as "+<digits>". */
export const mobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^\+?[1-9]\d{7,14}$/, "Enter a valid mobile number with country code, e.g. +919812345678")
      .transform((v) => (v.startsWith("+") ? v : `+${v}`)),
  );

export const nameSchema = z.string().trim().min(2, "Enter your full name").max(120);

export const countrySchema = z.string().trim().min(2, "Select a country").max(80);

export const loginSchema = z.object({
  email: emailSchema,
  // Do not enforce password rules at login: existing accounts must still be able to log in.
  password: z.string().min(1, "Enter your password").max(128),
});

export const buyerRegisterSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  mobile: mobileSchema,
  password: passwordSchema,
  country: countrySchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const otpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(200),
});

/** Seller business fields. Documents are validated separately (see lib/storage/upload-validation.ts). */
export const businessTypeValues = [
  "SOLE_PROPRIETORSHIP",
  "PARTNERSHIP",
  "LLP",
  "PRIVATE_LIMITED",
  "PUBLIC_LIMITED",
  "OTHER",
] as const;

export const sellerBusinessSchema = z.object({
  businessName: z.string().trim().min(2, "Enter the business name").max(160),
  businessType: z.enum(businessTypeValues, { message: "Select a business type" }),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined))
    .pipe(
      z
        .string()
        .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GST number")
        .optional(),
    ),
  addressLine: z.string().trim().min(5, "Enter the street address").max(200),
  city: z.string().trim().min(2, "Enter the city").max(80),
  state: z.string().trim().min(2, "Enter the state").max(80),
  country: countrySchema,
  pincode: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().regex(/^[0-9]{6}$/, "Enter a 6-digit PIN code").optional()),
  yearsInBusiness: z.coerce.number().int().min(0).max(200),
  specialties: z
    .array(z.string().trim().min(1).max(40))
    .min(1, "Add at least one specialty")
    .max(20),
});

export const rejectSellerSchema = z.object({
  sellerId: z.string().min(1),
  reason: z.string().trim().min(10, "Give a reason of at least 10 characters").max(1000),
});

export const sellerIdSchema = z.object({
  sellerId: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type BuyerRegisterInput = z.infer<typeof buyerRegisterSchema>;
export type SellerBusinessInput = z.infer<typeof sellerBusinessSchema>;
