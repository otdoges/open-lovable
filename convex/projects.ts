import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all projects for a user
export const getUserProjects = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get project by ID
export const getProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

// Create new project
export const createProject = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    gitUrl: v.optional(v.string()),
    gitBranch: v.optional(v.string()),
    isPrivateRepo: v.optional(v.boolean()),
    projectType: v.union(v.literal("cloned"), v.literal("generated"), v.literal("imported")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      gitUrl: args.gitUrl,
      gitBranch: args.gitBranch || "main",
      isPrivateRepo: args.isPrivateRepo || false,
      lastCommitHash: undefined,
      projectType: args.projectType,
      status: "active",
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
    });

    return projectId;
  },
});

// Update project
export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    gitBranch: v.optional(v.string()),
    lastCommitHash: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"), v.literal("error"))),
  },
  handler: async (ctx, args) => {
    const { projectId, ...updates } = args;
    
    await ctx.db.patch(projectId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return projectId;
  },
});

// Increment project access count
export const incrementAccessCount = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    await ctx.db.patch(args.projectId, {
      accessCount: project.accessCount + 1,
      updatedAt: Date.now(),
    });

    return project.accessCount + 1;
  },
});

// Archive project
export const archiveProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      status: "archived",
      updatedAt: Date.now(),
    });

    return args.projectId;
  },
});

// Delete project and related data
export const deleteProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    // Delete related sandboxes
    const sandboxes = await ctx.db
      .query("sandboxes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const sandbox of sandboxes) {
      await ctx.db.delete(sandbox._id);
    }

    // Delete file snapshots
    const snapshots = await ctx.db
      .query("fileSnapshots")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id);
    }

    // Delete chat history
    const chatHistory = await ctx.db
      .query("chatHistory")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const chat of chatHistory) {
      await ctx.db.delete(chat._id);
    }

    // Delete project shares
    const shares = await ctx.db
      .query("projectShares")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const share of shares) {
      await ctx.db.delete(share._id);
    }

    // Finally delete the project
    await ctx.db.delete(args.projectId);

    return args.projectId;
  },
});

// Get recent projects
export const getRecentProjects = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .take(args.limit || 10);
  },
});