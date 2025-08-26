import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Track usage
export const trackUsage = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(v.literal("sandbox_hours"), v.literal("ai_requests"), v.literal("git_operations"), v.literal("storage_mb")),
    amount: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const usageId = await ctx.db.insert("usage", {
      userId: args.userId,
      type: args.type,
      amount: args.amount,
      timestamp: Date.now(),
      metadata: args.metadata,
    });

    return usageId;
  },
});

// Get usage for a user in a time period
export const getUserUsage = query({
  args: {
    userId: v.id("users"),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => 
        q.and(
          q.gte(q.field("timestamp"), args.startTime),
          q.lte(q.field("timestamp"), args.endTime)
        )
      )
      .collect();

    // Aggregate by type
    const aggregated = usage.reduce((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = 0;
      }
      acc[item.type] += item.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      raw: usage,
      aggregated,
      totalRecords: usage.length,
    };
  },
});

// Get current month usage for a user
export const getCurrentMonthUsage = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    return await ctx.db
      .query("usage")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => 
        q.and(
          q.gte(q.field("timestamp"), startOfMonth),
          q.lte(q.field("timestamp"), endOfMonth)
        )
      )
      .collect()
      .then(usage => {
        const aggregated = usage.reduce((acc, item) => {
          if (!acc[item.type]) {
            acc[item.type] = 0;
          }
          acc[item.type] += item.amount;
          return acc;
        }, {} as Record<string, number>);

        return {
          sandbox_hours: aggregated.sandbox_hours || 0,
          ai_requests: aggregated.ai_requests || 0,
          git_operations: aggregated.git_operations || 0,
          storage_mb: aggregated.storage_mb || 0,
        };
      });
  },
});

// Track AI request
export const trackAIRequest = mutation({
  args: {
    userId: v.id("users"),
    model: v.string(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("usage", {
      userId: args.userId,
      type: "ai_requests",
      amount: 1,
      timestamp: Date.now(),
      metadata: {
        model: args.model,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
      },
    });
  },
});

// Track sandbox time
export const trackSandboxTime = mutation({
  args: {
    userId: v.id("users"),
    sandboxId: v.string(),
    minutes: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("usage", {
      userId: args.userId,
      type: "sandbox_hours",
      amount: args.minutes / 60, // Convert to hours
      timestamp: Date.now(),
      metadata: {
        sandboxId: args.sandboxId,
        minutes: args.minutes,
      },
    });
  },
});

// Track git operation
export const trackGitOperation = mutation({
  args: {
    userId: v.id("users"),
    operation: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("usage", {
      userId: args.userId,
      type: "git_operations",
      amount: 1,
      timestamp: Date.now(),
      metadata: {
        operation: args.operation,
        projectId: args.projectId,
      },
    });
  },
});

// Get usage summary for billing
export const getUsageSummary = query({
  args: {
    userId: v.id("users"),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => 
        q.and(
          q.gte(q.field("timestamp"), args.startTime),
          q.lte(q.field("timestamp"), args.endTime)
        )
      )
      .collect();

    const summary = {
      sandboxHours: 0,
      aiRequests: 0,
      gitOperations: 0,
      storageMB: 0,
      totalCost: 0,
    };

    usage.forEach(item => {
      switch (item.type) {
        case "sandbox_hours":
          summary.sandboxHours += item.amount;
          break;
        case "ai_requests":
          summary.aiRequests += item.amount;
          break;
        case "git_operations":
          summary.gitOperations += item.amount;
          break;
        case "storage_mb":
          summary.storageMB += item.amount;
          break;
      }
    });

    // Calculate costs (example pricing)
    summary.totalCost = 
      (summary.sandboxHours * 0.10) + // $0.10 per hour
      (summary.aiRequests * 0.01) +   // $0.01 per request
      (summary.gitOperations * 0.005) + // $0.005 per operation
      (summary.storageMB * 0.0001);    // $0.0001 per MB

    return summary;
  },
});