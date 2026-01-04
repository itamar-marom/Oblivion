"use client";

import { AuthProvider } from "@/contexts/auth-context";
import type { ReactNode } from "react";

/**
 * App providers wrapper
 *
 * Wraps the app with all necessary context providers:
 * - AuthProvider: JWT authentication state
 */
export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
