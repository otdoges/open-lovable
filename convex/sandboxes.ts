import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all sandboxes for a user
export const getUserSandboxes = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get sandbox by E2B sandbox ID
export const getSandboxBySandboxId = query({
  args: { sandboxId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox_id", (q) => q.eq("sandboxId", args.sandboxId))
      .first();
  },
});

// Get sandboxes for a project
export const getProjectSandboxes = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

// Create new sandbox
export const createSandbox = mutation({
  args: {
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    sandboxId: v.string(),
    name: v.string(),
    url: v.optional(v.string()),
    isTemporary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const autoStopAt = now + (15 * 60 * 1000); // 15 minutes from now
    
    const id = await ctx.db.insert("sandboxes", {
      userId: args.userId,
      projectId: args.projectId,
      sandboxId: args.sandboxId,
      name: args.name,
      url: args.url,
      status: "creating",
      startedAt: now,
      lastActiveAt: now,
      autoStopAt,
      isTemporary: args.isTemporary || false,
    });

    return id;
  },
});

// Update sandbox status
export const updateSandboxStatus = mutation({
  args: {
    sandboxId: v.string(),
    status: v.union(v.literal("creating"), v.literal("running"), v.literal("stopped"), v.literal("error")),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox_id", (q) => q.eq("sandboxId", args.sandboxId))
      .first();

    if (!sandbox) {
      throw new Error("Sandbox not found");
    }

    await ctx.db.patch(sandbox._id, {
      status: args.status,
      url: args.url,
      lastActiveAt: Date.now(),
    });

    return sandbox._id;
  },
});

// Update sandbox activity
export const updateSandboxActivity = mutation({
  args: { sandboxId: v.string() },
  handler: async (ctx, args) => {
    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox_id", (q) => q.eq("sandboxId", args.sandboxId))
      .first();

    if (!sandbox) {
      throw new Error("Sandbox not found");
    }

    const now = Date.now();
    const newAutoStopAt = now + (15 * 60 * 1000); // Extend by 15 minutes

    await ctx.db.patch(sandbox._id, {
      lastActiveAt: now,
      autoStopAt: newAutoStopAt,
    });

    return sandbox._id;
  },
});

// Stop sandbox
export const stopSandbox = mutation({
  args: { sandboxId: v.string() },
  handler: async (ctx, args) => {
    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox_id", (q) => q.eq("sandboxId", args.sandboxId))
      .first();

    if (!sandbox) {
      throw new Error("Sandbox not found");
    }

    await ctx.db.patch(sandbox._id, {
      status: "stopped",
      lastActiveAt: Date.now(),
    });

    return sandbox._id;
  },
});

// Get running sandboxes that should be auto-stopped
export const getSandboxesToAutoStop = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("sandboxes")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .filter((q) => q.lt(q.field("autoStopAt"), now))
      .collect();
  },
});

// Get active sandboxes for a user
export const getActiveSandboxes = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.or(
        q.eq(q.field("status"), "running"),
        q.eq(q.field("status"), "creating")
      ))
      .collect();
  },
});

// Delete sandbox
export const deleteSandbox = mutation({
  args: { sandboxId: v.string() },
  handler: async (ctx, args) => {
    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox_id", (q) => q.eq("sandboxId", args.sandboxId))
      .first();

    if (!sandbox) {
      throw new Error("Sandbox not found");
    }

    // Delete related file snapshots
    const snapshots = await ctx.db
      .query("fileSnapshots")
      .withIndex("by_sandbox", (q) => q.eq("sandboxId", sandbox._id))
      .collect();

    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id);
    }

    // Delete related chat history
    const chatHistory = await ctx.db
      .query("chatHistory")
      .filter((q) => q.eq(q.field("sandboxId"), sandbox._id))
      .collect();

    for (const chat of chatHistory) {
      await ctx.db.delete(chat._id);
    }

    // Delete the sandbox
    await ctx.db.delete(sandbox._id);

    return sandbox._id;
  },
});