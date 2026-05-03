"use client";

/* Client-side providers wrapper - renders AuthProvider + Navbar + Toast around children */

import { type ReactNode } from "react";
import { PublicThemeToggle } from "@/components/theme-toggle";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/components/toast";
import Navbar from "@/components/navbar";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Navbar />
          <PublicThemeToggle />
          {children}
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
