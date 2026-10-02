import { z } from "zod";

export const apiEnvelopeSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.boolean(),
    data: data.nullable(),
    error: z.string().nullable(),
  });

export const accountTypeSchema = z.enum(["CASH", "BANK", "CREDIT_CARD", "SAVINGS"]);
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
