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

export const messageTextSchema = z.string().trim().min(1).max(4000);

export const conversationImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const conversationFileMimeTypes = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const maxConversationAttachmentBytes = 10 * 1024 * 1024;
export const maxConversationAttachmentsPerMessage = 4;

export const conversationAttachmentSchema = z
  .object({
    kind: z.enum(["IMAGE", "FILE"]),
    mimeType: z.string().trim().min(1).max(160),
    fileSizeBytes: z
      .number()
      .int()
      .positive()
      .max(maxConversationAttachmentBytes),
    originalName: z.string().trim().min(1).max(180),
  })
  .superRefine((value, context) => {
    const allowed =
      value.kind === "IMAGE"
        ? conversationImageMimeTypes
        : conversationFileMimeTypes;
    if (!(allowed as readonly string[]).includes(value.mimeType)) {
      context.addIssue({
        code: "custom",
        path: ["mimeType"],
        message: "Unsupported attachment type.",
      });
    }
  });

export function sanitizeAttachmentFilename(value: string): string {
  const basename = value.split(/[\\/]/).pop() ?? "";
  const normalized = basename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/[-_.]{2,}/g, (match) => (match.includes(".") ? "." : "-"))
    .replace(/^[.\-_]+|[.\-_]+$/g, "");

  if (!normalized) return "archivo";
  if (normalized.length <= 180) return normalized;

  const dot = normalized.lastIndexOf(".");
  const extension = dot > 0 ? normalized.slice(dot).slice(0, 20) : "";
  const stemLimit = Math.max(1, 180 - extension.length);
  const stem = (dot > 0 ? normalized.slice(0, dot) : normalized)
    .slice(0, stemLimit)
    .replace(/[.\-_]+$/g, "");
  return `${stem || "archivo"}${extension}`.slice(0, 180);
}

const uuidSchema = z.uuid();
const dateSchema = z.iso.date();
const timeSchema = z.iso.time({ precision: -1 });
const positiveInteger = z.number().int().positive();
const positiveMinorUnits = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
const optionalBoundedText = (max: number) =>
  z.string().trim().max(max).optional().default("");

export const marketplacePriceModels = [
  "FIXED",
  "STARTING_AT",
  "HOURLY",
  "PER_UNIT",
  "QUOTE",
] as const;

export const marketplaceModalities = ["IN_PERSON", "REMOTE", "BOTH"] as const;

export const marketplaceScheduleTypes = [
  "FIXED_SLOT",
  "FLEXIBLE_WINDOW",
  "DEADLINE",
  "UNSCHEDULED",
] as const;

export const serviceSchema = z
  .object({
    skillId: uuidSchema,
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(20).max(3000),
    modality: z.enum(marketplaceModalities),
    priceModel: z.enum(marketplacePriceModels),
    priceAmount: positiveMinorUnits.optional(),
    currencyCode: z.literal("ARS"),
    priceUnit: z.string().trim().max(60).optional().default(""),
    acceptsOffers: z.boolean(),
    expectedDurationMinutes: positiveInteger.max(7 * 24 * 60).optional(),
    scheduleType: z.enum(marketplaceScheduleTypes),
    includes: optionalBoundedText(1500),
    excludes: optionalBoundedText(1500),
    materialsNotes: optionalBoundedText(1500),
    isPublished: z.boolean(),
    isPaused: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.priceModel === "QUOTE" && value.priceAmount !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["priceAmount"],
        message: "Quote services cannot have a fixed amount.",
      });
    }
    if (value.priceModel !== "QUOTE" && value.priceAmount === undefined) {
      context.addIssue({
        code: "custom",
        path: ["priceAmount"],
        message: "This pricing model requires an amount.",
      });
    }
    if (value.priceModel === "PER_UNIT" && !value.priceUnit) {
      context.addIssue({
        code: "custom",
        path: ["priceUnit"],
        message: "Per-unit services require a unit.",
      });
    }
    if (value.priceModel !== "PER_UNIT" && value.priceUnit) {
      context.addIssue({
        code: "custom",
        path: ["priceUnit"],
        message: "Only per-unit services use a unit.",
      });
    }
  });

export const maxServiceTags = 8;

export function normalizeServiceTag(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export const serviceTagsSchema = z
  .array(z.string().trim().min(2).max(80))
  .max(maxServiceTags)
  .superRefine((tags, context) => {
    const seen = new Map<string, number>();
    tags.forEach((tag, index) => {
      const normalized = normalizeServiceTag(tag);
      const previousIndex = seen.get(normalized);
      if (previousIndex !== undefined) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: `Duplicate of tag at position ${previousIndex + 1}.`,
        });
      } else {
        seen.set(normalized, index);
      }
    });
  })
  .transform((tags) => tags.map(normalizeServiceTag));

const professionalRecordBase = {
  description: optionalBoundedText(2000),
  isPublic: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
};

export const experienceSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    organization: optionalBoundedText(160),
    ...professionalRecordBase,
    startedOn: dateSchema,
    endedOn: dateSchema.optional(),
    isCurrent: z.boolean(),
  })
  .refine(
    (value) =>
      value.isCurrent ||
      value.endedOn === undefined ||
      value.endedOn >= value.startedOn,
    {
      message: "The end date must be after the start date.",
      path: ["endedOn"],
    },
  );

export const educationSchema = z
  .object({
    institution: z.string().trim().min(2).max(160),
    fieldOfStudy: optionalBoundedText(160),
    ...professionalRecordBase,
    startedOn: dateSchema,
    endedOn: dateSchema.optional(),
  })
  .refine(
    (value) => value.endedOn === undefined || value.endedOn >= value.startedOn,
    {
      message: "The end date must be after the start date.",
      path: ["endedOn"],
    },
  );

export const certificationSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    issuer: optionalBoundedText(160),
    description: optionalBoundedText(1500),
    issuedOn: dateSchema.optional(),
    expiresOn: dateSchema.optional(),
    isPublic: z.boolean(),
    sortOrder: z.number().int().min(0).max(999),
  })
  .refine(
    (value) =>
      value.issuedOn === undefined ||
      value.expiresOn === undefined ||
      value.expiresOn >= value.issuedOn,
    {
      message: "The expiry date must be after the issue date.",
      path: ["expiresOn"],
    },
  );

export const portfolioSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: optionalBoundedText(1500),
  isPublic: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});

export const serviceAreaSchema = z.object({
  label: z.string().trim().min(2).max(160),
  radiusMeters: positiveInteger.min(100).max(100_000),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isActive: z.boolean(),
});

export const availabilityRuleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
    timezone: z.string().trim().min(1).max(64),
    isActive: z.boolean(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "The end time must be after the start time.",
    path: ["endTime"],
  });

export const availabilityBlockSchema = z
  .object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    reason: optionalBoundedText(240),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "The end must be after the start.",
    path: ["endsAt"],
  });

export const providerMarketplaceSettingsSchema = z.object({
  publicSlug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  publicHeadline: optionalBoundedText(160),
  marketplacePaused: z.boolean(),
  availabilityPaused: z.boolean(),
});
