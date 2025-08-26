import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table for authentication and profile data
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    avatar: v.optional(v.string()),
    githubId: v.optional(v.string()),
    isActive: v.boolean(),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  })
  .index("by_email", ["email"])
  .index("by_github_id", ["githubId"]),

  // Projects table for cloned repositories and user projects
  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    gitUrl: v.optional(v.string()),
    gitBranch: v.optional(v.string()),
    isPrivateRepo: v.boolean(),
    lastCommitHash: v.optional(v.string()),
    projectType: v.union(v.literal("cloned"), v.literal("generated"), v.literal("imported")),
    status: v.union(v.literal("active"), v.literal("archived"), v.literal("error")),
    createdAt: v.number(),
    updatedAt: v.number(),
    accessCount: v.number(),
  })
  .index("by_user", ["userId"])
  .index("by_status", ["status"])
  .index("by_updated", ["updatedAt"]),

  // Sandboxes table for E2B sandbox management
  sandboxes: defineTable({
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    sandboxId: v.string(), // E2B sandbox ID
    name: v.string(),
    url: v.optional(v.string()),
    status: v.union(v.literal("creating"), v.literal("running"), v.literal("stopped"), v.literal("error")),
    startedAt: v.number(),
    lastActiveAt: v.number(),
    autoStopAt: v.optional(v.number()),
    isTemporary: v.boolean(),
  })
  .index("by_user", ["userId"])
  .index("by_project", ["projectId"])
  .index("by_sandbox_id", ["sandboxId"])
  .index("by_status", ["status"]),

  // File snapshots for version control and backup
  fileSnapshots: defineTable({
    projectId: v.id("projects"),
    sandboxId: v.id("sandboxes"),
    filePath: v.string(),
    content: v.string(),
    hash: v.string(),
    size: v.number(),
    createdAt: v.number(),
  })
  .index("by_project", ["projectId"])
  .index("by_sandbox", ["sandboxId"])
  .index("by_hash", ["hash"]),

  // Chat history for AI conversations
  chatHistory: defineTable({
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    sandboxId: v.optional(v.id("sandboxes")),
    sessionId: v.string(),
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
      content: v.string(),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_user", ["userId"])
  .index("by_project", ["projectId"])
  .index("by_session", ["sessionId"]),

  // Usage tracking for billing
  usage: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("sandbox_hours"), v.literal("ai_requests"), v.literal("git_operations"), v.literal("storage_mb")),
    amount: v.number(),
    timestamp: v.number(),
    metadata: v.optional(v.any()),
  })
  .index("by_user", ["userId"])
  .index("by_type", ["type"])
  .index("by_timestamp", ["timestamp"]),

  // Subscriptions and billing
  subscriptions: defineTable({
    userId: v.id("users"),
    polarSubscriptionId: v.string(),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    status: v.union(v.literal("active"), v.literal("cancelled"), v.literal("past_due"), v.literal("unpaid")),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_user", ["userId"])
  .index("by_polar_id", ["polarSubscriptionId"])
  .index("by_status", ["status"]),

  // Team/collaboration features
  teams: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    members: v.array(v.object({
      userId: v.id("users"),
      role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
      joinedAt: v.number(),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_owner", ["ownerId"]),

  // Project sharing and permissions
  projectShares: defineTable({
    projectId: v.id("projects"),
    sharedByUserId: v.id("users"),
    sharedWithUserId: v.optional(v.id("users")),
    sharedWithTeamId: v.optional(v.id("teams")),
    permissions: v.union(v.literal("read"), v.literal("write"), v.literal("admin")),
    isPublic: v.boolean(),
    shareToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
  .index("by_project", ["projectId"])
  .index("by_shared_by", ["sharedByUserId"])
  .index("by_shared_with_user", ["sharedWithUserId"])
  .index("by_shared_with_team", ["sharedWithTeamId"])
  .index("by_share_token", ["shareToken"]),
});