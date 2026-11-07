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
  primaryKey,
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

export const organizations = appSchema.table("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgMemberships = appSchema.table(
  "org_memberships",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.userId] }),
    index("org_memberships_user_id_idx").on(t.userId),
  ],
);

export const platformAdmins = appSchema.table("platform_admins", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = appSchema.table(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
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
  (t) => [index("accounts_user_id_idx").on(t.userId), index("accounts_org_id_idx").on(t.orgId)],
);

export const transactions = appSchema.table(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
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
    uniqueIndex("transactions_org_idempotency_uidx").on(t.orgId, t.idempotencyKey),
    index("transactions_user_occurred_idx").on(t.userId, t.occurredOn, t.id),
    index("transactions_org_occurred_idx").on(t.orgId, t.occurredOn, t.id),
    index("transactions_account_occurred_idx").on(t.accountId, t.occurredOn),
  ],
);

export const budgets = appSchema.table(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("budgets_org_id_uidx").on(t.orgId)],
);
