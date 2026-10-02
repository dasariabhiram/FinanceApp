import {
  boolean,
  date,
  pgSchema,
  text,
  timestamp,
  uuid,
  bigint,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const appSchema = pgSchema("app");

export const profiles = appSchema.table("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  currency: text("currency").notNull().default("INR"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = appSchema.table(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    currency: text("currency").notNull().default("INR"),
    balanceMinor: bigint("balance_minor", { mode: "bigint" }).notNull().default(0n),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const transactions = appSchema.table(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    category: text("category").notNull(),
    description: text("description"),
    occurredOn: date("occurred_on").notNull(),
    status: text("status").notNull().default("POSTED"),
    idempotencyKey: text("idempotency_key").notNull(),
    transferGroupId: uuid("transfer_group_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("transactions_user_idempotency_uidx").on(t.userId, t.idempotencyKey),
    index("transactions_user_occurred_idx").on(t.userId, t.occurredOn, t.id),
    index("transactions_account_occurred_idx").on(t.accountId, t.occurredOn),
  ],
);

export const budgets = appSchema.table("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: "cascade" }),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
