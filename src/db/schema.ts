import { pgTable, serial, text, timestamp, boolean, integer, jsonb, numeric, pgEnum } from "drizzle-orm/pg-core";

// ═══════════════════════════════════════════
// USERS — full auth support
// ═══════════════════════════════════════════
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"), // null for OAuth-only users
  role: text("role").default("user").notNull(), // user | admin | super_admin
  plan: text("plan").default("free").notNull(), // free | pro | premium | admin
  status: text("status").default("active").notNull(), // active | suspended | deleted | pending_verification
  credits: integer("credits").default(100).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerifyToken: text("email_verify_token"),
  emailVerifyExpires: timestamp("email_verify_expires"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  twoFactorSecret: text("two_factor_secret"),
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActive: timestamp("last_active"),
  deletedAt: timestamp("deleted_at"),
});

// ═══════════════════════════════════════════
// SESSIONS — enhanced with device tracking
// ═══════════════════════════════════════════
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id),
  deviceInfo: text("device_info"), // User-Agent string
  ipAddress: text("ip_address"),
  location: text("location"), // City, Country (approximate)
  rememberMe: boolean("remember_me").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// OAUTH ACCOUNTS — social login providers
// ═══════════════════════════════════════════
export const oauthAccounts = pgTable("oauth_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(), // google | github
  providerAccountId: text("provider_account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpires: timestamp("token_expires"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// LOGIN ATTEMPTS — rate limiting & security
// ═══════════════════════════════════════════
export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  ipAddress: text("ip_address"),
  success: boolean("success").default(false).notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// PLANS — configurable by admin
// ═══════════════════════════════════════════
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Free, Pro, Premium
  slug: text("slug").notNull().unique(), // free, pro, premium
  price: numeric("price").default("0").notNull(),
  interval: text("interval").default("month").notNull(), // month | year
  messageLimit: integer("message_limit").default(100).notNull(),
  agentLimit: integer("agent_limit").default(2).notNull(),
  researchLimit: integer("research_limit").default(5).notNull(),
  projectLimit: integer("project_limit").default(1).notNull(),
  allowedModels: text("allowed_models").default("groq-llama,llm7-gemini,pollinations").notNull(),
  features: text("features").default("chat,basic_search").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// SUBSCRIPTIONS — user → plan mapping
// ═══════════════════════════════════════════
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  planSlug: text("plan_slug").notNull(),
  status: text("status").default("active").notNull(), // active | cancelled | expired
  startedAt: timestamp("started_at").defaultNow().notNull(),
  renewsAt: timestamp("renews_at"),
  cancelledAt: timestamp("cancelled_at"),
});

// ═══════════════════════════════════════════
// USAGE LOGS — track every AI request
// ═══════════════════════════════════════════
export const usageLogs = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // chat | research | coding | image | search
  model: text("model"),
  agentsUsed: text("agents_used"),
  tokensIn: integer("tokens_in").default(0),
  tokensOut: integer("tokens_out").default(0),
  estimatedCost: numeric("estimated_cost").default("0").notNull(),
  mode: text("mode").default("balanced").notNull(),
  success: boolean("success").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// AUDIT LOGS — track admin actions
// ═══════════════════════════════════════════
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  action: text("action").notNull(), // user_plan_change, user_suspend, model_update, etc.
  targetId: integer("target_id"),
  targetEmail: text("target_email"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// FEATURE FLAGS — toggle features globally or per plan
// ═══════════════════════════════════════════
export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // coding_workspace, deep_research, voice, etc.
  label: text("label").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  minPlan: text("min_plan").default("free").notNull(), // free | pro | premium
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// PROJECTS — user coding projects
// ═══════════════════════════════════════════
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  files: text("files").default("{}").notNull(), // JSON: { path: content }
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// MODELS REGISTRY — admin-managed model config
// ═══════════════════════════════════════════
export const modelRegistry = pgTable("model_registry", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
  displayName: text("display_name").notNull(),
  accessLevel: text("access_level").default("free").notNull(), // free | pro | premium | admin
  status: text("status").default("active").notNull(), // active | disabled
  priority: integer("priority").default(50).notNull(),
  costPerMtok: numeric("cost_per_mtok").default("0").notNull(),
  capabilities: text("capabilities").default("general").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Keep existing tables
export const memories = pgTable("memories", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userState = pgTable("user_state", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  data: text("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// CREDIT TRANSACTIONS — ledger for all credit changes
// ═══════════════════════════════════════════
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(), // positive = credit added, negative = used
  type: text("type").notNull(), // plan_grant | purchase | usage | refund | bonus | admin_adjust | expired
  description: text("description"),
  balanceAfter: integer("balance_after"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// ═══════════════════════════════════════════
// PAYMENTS — payment records (Stripe/manual)
// ═══════════════════════════════════════════
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: numeric("amount").notNull(),
  currency: text("currency").default("USD").notNull(),
  status: text("status").default("pending").notNull(), // pending | succeeded | failed | refunded
  provider: text("provider"), // stripe | manual
  providerPaymentId: text("provider_payment_id"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// INVOICES — billing records
// ═══════════════════════════════════════════
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  amount: numeric("amount").notNull(),
  tax: numeric("tax").default("0").notNull(),
  total: numeric("total").notNull(),
  planSlug: text("plan_slug"),
  status: text("status").default("draft").notNull(), // draft | paid | void | uncollectible
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// API KEYS — user API access
// ═══════════════════════════════════════════
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(), // store hash, never raw key
  keyPrefix: text("key_prefix").notNull(), // show "nexora_abc...***"
  permissions: text("permissions").default("chat").notNull(), // chat,research,images
  status: text("status").default("active").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// NOTIFICATIONS — user-facing notifications
// ═══════════════════════════════════════════
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // subscription | payment | credits | usage | security | system | trial
  title: text("title").notNull(),
  message: text("message"),
  read: boolean("read").default(false).notNull(),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// SUPPORT TICKETS
// ═══════════════════════════════════════════
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").default("open").notNull(), // open | pending | resolved | closed
  priority: text("priority").default("normal").notNull(), // low | normal | high | urgent
  assignedTo: integer("assigned_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ticketReplies = pgTable("ticket_replies", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTickets.id),
  userId: integer("user_id").notNull(),
  message: text("message").notNull(),
  isStaff: boolean("is_staff").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// COUPONS — promotional codes
// ═══════════════════════════════════════════
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // percentage | fixed | trial | credits
  value: numeric("value").notNull(),
  maxUses: integer("max_uses").default(-1).notNull(), // -1 = unlimited
  usedCount: integer("used_count").default(0).notNull(),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// CONVERSATIONS — user chat history (server-side)
// ═══════════════════════════════════════════
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").default("New Chat").notNull(),
  messages: text("messages").default("[]").notNull(), // JSON array
  pinned: boolean("pinned").default(false).notNull(),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// FEEDBACK — AI response ratings
// ═══════════════════════════════════════════
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  rating: text("rating").notNull(), // up | down
  comment: text("comment"),
  model: text("model"),
  messageType: text("message_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// REFERRALS — track referral links
// ═══════════════════════════════════════════
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => users.id),
  referredId: integer("referred_id").references(() => users.id),
  referralCode: text("referral_code").notNull().unique(),
  status: text("status").default("pending").notNull(), // pending | converted | rewarded
  rewardGiven: boolean("reward_given").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// SYSTEM SETTINGS — platform-wide config
// ═══════════════════════════════════════════
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category").default("general").notNull(), // general | ai | billing | security | email
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// PROMPT TEMPLATES — admin-managed system prompts
// ═══════════════════════════════════════════
export const promptTemplates = pgTable("prompt_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  version: integer("version").default(1).notNull(),
  status: text("status").default("draft").notNull(), // draft | testing | active | archived
  task: text("task").notNull(), // general | coding | research | creative
  content: text("content").notNull(),
  model: text("model"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════
// RATE LIMITS — track and enforce rate limits
// ═══════════════════════════════════════════
export const rateLimits = pgTable("rate_limits", {
  id: serial("id").primaryKey(),
  identifier: text("identifier").notNull(), // user_id or IP
  endpoint: text("endpoint").notNull(),
  count: integer("count").default(0).notNull(),
  windowStart: timestamp("window_start").defaultNow().notNull(),
});
