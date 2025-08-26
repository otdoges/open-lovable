import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get subscription by user
export const getUserSubscription = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
  },
});

// Get subscription by Polar ID
export const getByPolarId = query({
  args: { polarSubscriptionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_polar_id", (q) => q.eq("polarSubscriptionId", args.polarSubscriptionId))
      .first();
  },
});

// Create subscription
export const createSubscription = mutation({
  args: {
    userId: v.id("users"),
    polarSubscriptionId: v.string(),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    status: v.union(v.literal("active"), v.literal("cancelled"), v.literal("past_due"), v.literal("unpaid")),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if subscription already exists
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_polar_id", (q) => q.eq("polarSubscriptionId", args.polarSubscriptionId))
      .first();

    if (existing) {
      // Update existing subscription instead
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new subscription
    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId: args.userId,
      polarSubscriptionId: args.polarSubscriptionId,
      tier: args.tier,
      status: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      createdAt: now,
      updatedAt: now,
    });

    return subscriptionId;
  },
});

// Update subscription
export const updateSubscription = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    tier: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise"))),
    status: v.optional(v.union(v.literal("active"), v.literal("cancelled"), v.literal("past_due"), v.literal("unpaid"))),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { subscriptionId, ...updates } = args;
    
    await ctx.db.patch(subscriptionId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return subscriptionId;
  },
});

// Cancel subscription
export const cancelSubscription = mutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subscriptionId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return args.subscriptionId;
  },
});

// Get active subscriptions
export const getActiveSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

// Check if user has active subscription
export const hasActiveSubscription = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .first();

    if (!subscription) return false;

    // Check if subscription is not expired
    const now = Date.now();
    return subscription.currentPeriodEnd > now;
  },
});

// Get subscription stats
export const getSubscriptionStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("subscriptions").collect();
    
    const stats = {
      total: all.length,
      active: 0,
      cancelled: 0,
      pastDue: 0,
      unpaid: 0,
      byTier: {
        free: 0,
        pro: 0,
        enterprise: 0,
      },
      revenue: {
        monthly: 0, // This would need more complex calculation
        annual: 0,
      }
    };

    all.forEach(sub => {
      switch (sub.status) {
        case "active":
          stats.active++;
          break;
        case "cancelled":
          stats.cancelled++;
          break;
        case "past_due":
          stats.pastDue++;
          break;
        case "unpaid":
          stats.unpaid++;
          break;
      }

      stats.byTier[sub.tier]++;
    });

    return stats;
  },
});