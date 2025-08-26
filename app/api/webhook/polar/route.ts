import { Webhooks } from "@polar-sh/nextjs";
import { api } from "../../../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => {
    console.log("Received Polar webhook:", payload.type);
    
    try {
      switch (payload.type) {
        case "checkout.created":
          await handleCheckoutCreated(payload.data);
          break;
          
        case "order.paid":
          await handleOrderPaid(payload.data);
          break;
          
        case "subscription.created":
          await handleSubscriptionCreated(payload.data);
          break;
          
        case "subscription.updated":
          await handleSubscriptionUpdated(payload.data);
          break;
          
        case "subscription.cancelled":
          await handleSubscriptionCancelled(payload.data);
          break;
          
        default:
          console.log(`Unhandled webhook type: ${payload.type}`);
      }
    } catch (error) {
      console.error("Error processing Polar webhook:", error);
      throw error; // This will cause the webhook to be retried
    }
  },
  
  // Granular event handlers
  onCheckoutCreated: async (payload) => {
    console.log("Checkout created:", payload.id);
    // Handle checkout creation if needed
  },
  
  onOrderPaid: async (payload) => {
    console.log("Order paid:", payload.id);
    // Handle successful payment
    await handleOrderPaid(payload);
  },
  
  onSubscriptionCreated: async (payload) => {
    console.log("Subscription created:", payload.id);
    await handleSubscriptionCreated(payload);
  },
  
  onSubscriptionUpdated: async (payload) => {
    console.log("Subscription updated:", payload.id);
    await handleSubscriptionUpdated(payload);
  },
  
  onSubscriptionCancelled: async (payload) => {
    console.log("Subscription cancelled:", payload.id);
    await handleSubscriptionCancelled(payload);
  },
});

async function handleCheckoutCreated(checkoutData: any) {
  // Log checkout creation
  console.log("Processing checkout creation:", checkoutData.id);
  
  // You might want to track checkout attempts in your database
  // This is optional based on your needs
}

async function handleOrderPaid(orderData: any) {
  try {
    const { customer_email, subscription_id, amount } = orderData;
    
    if (!customer_email) {
      console.error("No customer email in order data");
      return;
    }
    
    // Find user by email
    const user = await convex.query(api.users.getUserByEmail, { 
      email: customer_email 
    });
    
    if (!user) {
      console.error(`User not found for email: ${customer_email}`);
      return;
    }
    
    // Track payment in usage table
    await convex.mutation(api.usage.trackUsage, {
      userId: user._id,
      type: "payment" as any, // You might need to add this type to your schema
      amount: amount / 100, // Convert cents to dollars
      metadata: {
        orderId: orderData.id,
        subscriptionId: subscription_id,
      }
    });
    
    console.log(`Payment processed for user ${customer_email}: $${amount / 100}`);
  } catch (error) {
    console.error("Error handling order paid:", error);
    throw error;
  }
}

async function handleSubscriptionCreated(subscriptionData: any) {
  try {
    const { customer_email, id: polarSubscriptionId, current_period_start, current_period_end } = subscriptionData;
    
    if (!customer_email) {
      console.error("No customer email in subscription data");
      return;
    }
    
    // Find user by email
    const user = await convex.query(api.users.getUserByEmail, { 
      email: customer_email 
    });
    
    if (!user) {
      console.error(`User not found for email: ${customer_email}`);
      return;
    }
    
    // Determine tier based on subscription
    const tier = determineTierFromSubscription(subscriptionData);
    
    // Create subscription record
    await convex.mutation(api.subscriptions.createSubscription as any, {
      userId: user._id,
      polarSubscriptionId,
      tier,
      status: "active",
      currentPeriodStart: new Date(current_period_start).getTime(),
      currentPeriodEnd: new Date(current_period_end).getTime(),
    });
    
    // Update user tier
    await convex.mutation(api.users.updateUserTier, {
      userId: user._id,
      tier,
    });
    
    console.log(`Subscription created for user ${customer_email}: ${tier}`);
  } catch (error) {
    console.error("Error handling subscription created:", error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscriptionData: any) {
  try {
    const { id: polarSubscriptionId, customer_email, current_period_start, current_period_end } = subscriptionData;
    
    // Find existing subscription
    const subscription = await convex.query(api.subscriptions.getByPolarId as any, { 
      polarSubscriptionId 
    });
    
    if (!subscription) {
      console.error(`Subscription not found: ${polarSubscriptionId}`);
      return;
    }
    
    const tier = determineTierFromSubscription(subscriptionData);
    
    // Update subscription
    await convex.mutation(api.subscriptions.updateSubscription as any, {
      subscriptionId: subscription._id,
      tier,
      status: subscriptionData.status || "active",
      currentPeriodStart: new Date(current_period_start).getTime(),
      currentPeriodEnd: new Date(current_period_end).getTime(),
    });
    
    // Update user tier if changed
    if (subscription.tier !== tier) {
      const user = await convex.query(api.users.getUserByEmail, { 
        email: customer_email 
      });
      
      if (user) {
        await convex.mutation(api.users.updateUserTier, {
          userId: user._id,
          tier,
        });
      }
    }
    
    console.log(`Subscription updated: ${polarSubscriptionId} -> ${tier}`);
  } catch (error) {
    console.error("Error handling subscription updated:", error);
    throw error;
  }
}

async function handleSubscriptionCancelled(subscriptionData: any) {
  try {
    const { id: polarSubscriptionId, customer_email } = subscriptionData;
    
    // Find existing subscription
    const subscription = await convex.query(api.subscriptions.getByPolarId as any, { 
      polarSubscriptionId 
    });
    
    if (!subscription) {
      console.error(`Subscription not found: ${polarSubscriptionId}`);
      return;
    }
    
    // Update subscription status
    await convex.mutation(api.subscriptions.updateSubscription as any, {
      subscriptionId: subscription._id,
      status: "cancelled",
    });
    
    // Downgrade user to free tier
    const user = await convex.query(api.users.getUserByEmail, { 
      email: customer_email 
    });
    
    if (user) {
      await convex.mutation(api.users.updateUserTier, {
        userId: user._id,
        tier: "free",
      });
    }
    
    console.log(`Subscription cancelled: ${polarSubscriptionId}`);
  } catch (error) {
    console.error("Error handling subscription cancelled:", error);
    throw error;
  }
}

function determineTierFromSubscription(subscriptionData: any): "free" | "pro" | "enterprise" {
  // This logic depends on how you structure your products in Polar
  // You'll need to adjust this based on your actual product setup
  
  const { product, amount } = subscriptionData;
  
  // Example logic - adjust based on your products
  if (product?.name?.toLowerCase().includes("enterprise")) {
    return "enterprise";
  } else if (product?.name?.toLowerCase().includes("pro") || (amount && amount >= 2000)) {
    return "pro";
  }
  
  return "free";
}