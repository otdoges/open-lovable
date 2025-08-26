import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import Database from "better-sqlite3";
import path from "path";

export const auth = betterAuth({
  database: new Database(path.join(process.cwd(), "auth.db")),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      tier: {
        type: "string",
        defaultValue: "free",
      },
      isActive: {
        type: "boolean", 
        defaultValue: true,
      },
      createdAt: {
        type: "date",
        defaultValue: () => new Date(),
      },
      lastActiveAt: {
        type: "date",
        defaultValue: () => new Date(),
      },
    },
  },
  plugins: [
    nextCookies(),
  ],
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000"
  ],
});