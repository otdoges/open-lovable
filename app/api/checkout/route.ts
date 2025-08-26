import { Checkout } from "@polar-sh/nextjs";

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: process.env.BETTER_AUTH_URL + "/dashboard?checkout=success",
  server: process.env.NODE_ENV === "production" ? undefined : "sandbox", // Use sandbox for development
  theme: "dark",
});