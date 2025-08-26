"use client";

import { createAuthClient } from "better-auth/react";
import { nextCookies } from "better-auth/next-js";

export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [nextCookies()],
});

export const {
  signUp,
  signIn,
  signOut,
  useSession,
  getSession,
} = authClient;