import { z } from "zod";

export const publicSupabaseEnvSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

export type PublicSupabaseEnv = z.infer<typeof publicSupabaseEnvSchema>;

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const publicSiteUrlSchema = z
  .url()
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    { message: "The site URL must use HTTP or HTTPS." },
  );

const passwordSchema = z.string().min(8).max(128);

export const loginSchema = z.object({
  email: z.email(),
  password: passwordSchema,
});

export const signUpSchema = z
  .object({
    email: z.email(),
    password: passwordSchema,
    confirmPassword: passwordSchema,
    displayName: z.string().trim().min(2).max(80),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });

export const passwordResetSchema = z.object({
  email: z.email(),
});

export const passwordUpdateSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  publicZone: optionalText(120),
  bio: optionalText(1000),
  avatarUrl: z.url().max(2048).optional(),
});

export const privateProfileUpdateSchema = z.object({
  legalName: optionalText(160),
  privatePhone: optionalText(40),
  dateOfBirth: z.iso.date().optional(),
  exactAddress: optionalText(240),
  dniNumber: optionalText(40),
});

export const identityDocumentSchema = z.object({
  documentType: z.enum(["DNI_FRONT", "DNI_BACK", "SELFIE"]),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});
