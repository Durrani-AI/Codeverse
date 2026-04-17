"use client";

/* Client-side providers wrapper - renders AuthProvider + Navbar + Toast around children */

import { type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/toast";
import Navbar from "@/components/navbar";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <Navbar />
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}
