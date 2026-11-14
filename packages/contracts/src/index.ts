import { z } from "zod";

export const apiEnvelopeSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.boolean(),
    data: data.nullable(),
    error: z.string().nullable(),
  });

export const accountTypeSchema = z.enum(["CASH", "UPI", "BANK", "CREDIT_CARD", "SAVINGS"]);
export const orgStatusSchema = z.enum(["active", "suspended"]);
export const orgRoleSchema = z.enum(["org_owner", "org_member"]);
export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE", "TRANSFER"]);

export const accountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: accountTypeSchema,
  currency: z.string().length(3),
  balanceMinor: z.string(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
});

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: accountTypeSchema,
  currency: z.string().length(3).default("INR"),
  isDefault: z.boolean().optional(),
});

export const transactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  type: transactionTypeSchema,
  amountMinor: z.string(),
  category: z.string().min(1).max(80),
  description: z.string().max(500).nullable(),
  occurredOn: z.string(),
  status: z.enum(["POSTED", "PENDING_REVIEW"]),
  createdAt: z.string().datetime(),
});

export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(["INCOME", "EXPENSE"]),
  amountMinor: z.string().regex(/^-?\d+$/),
  category: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotencyKey: z.string().uuid(),
});

export const healthSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: z.string().datetime(),
});

export type Account = z.infer<typeof accountSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransaction = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z.object({
  accountId: z.string().uuid().optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  amountMinor: z.string().regex(/^-?\d+$/).optional(),
  category: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
  (v) =>
    v.accountId !== undefined ||
    v.type !== undefined ||
    v.amountMinor !== undefined ||
    v.category !== undefined ||
    v.description !== undefined ||
    v.occurredOn !== undefined,
  { message: "At least one field required" },
);
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;


export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: orgStatusSchema,
  timezone: z.string(),
  createdAt: z.string().datetime(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .trim()
    .transform((s) => s.toLowerCase())
    .pipe(z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens")),
  ownerEmail: z.string().email(),
});

export const membershipSchema = z.object({
  orgId: z.string().uuid(),
  orgName: z.string(),
  orgSlug: z.string(),
  role: orgRoleSchema,
});

export type Organization = z.infer<typeof organizationSchema>;
export type CreateOrganization = z.infer<typeof createOrganizationSchema>;
export type Membership = z.infer<typeof membershipSchema>;

export const parseExpenseResponseSchema = z.object({
  amountMinor: z.string().nullable(),
  category: z.string().nullable(),
  accountHint: z.string().nullable(),
  description: z.string().nullable(),
  occurredOn: z.string().nullable(),
  confidence: z.enum(["high", "low"]),
});

export type ParseExpenseResponse = z.infer<typeof parseExpenseResponseSchema>;
