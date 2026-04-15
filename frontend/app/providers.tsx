"use client";

/* Client-side providers wrapper - renders AuthProvider + Navbar around children */

import { type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import Navbar from "@/components/navbar";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Navbar />
      {children}
    </AuthProvider>
  );
}
