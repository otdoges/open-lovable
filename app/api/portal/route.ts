import { CustomerPortal } from "@polar-sh/nextjs";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  getCustomerId: async (req: NextRequest) => {
    try {
      // Get the current session
      const session = await auth.api.getSession({
        headers: await headers(),
      });

      if (!session?.user?.email) {
        throw new Error("User not authenticated");
      }

      // In a real implementation, you would:
      // 1. Look up the user's Polar customer ID from your database
      // 2. If they don't have one, create a new customer in Polar
      // 3. Return the customer ID
      
      // For now, return the user's email as a placeholder
      // You'll need to implement proper customer ID mapping
      return session.user.email;
    } catch (error) {
      console.error("Error getting customer ID:", error);
      throw error;
    }
  },
  server: process.env.NODE_ENV === "production" ? undefined : "sandbox",
});