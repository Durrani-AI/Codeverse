"use client";

/*
 * Auth Context - shared authentication state for the whole app.
 *
 * Provides:
 * - user: current User object (null while loading / logged out)
 * - isLoading: true while checking the token on mount
 * - isAuthenticated: shorthand for !!user
 * - login(token): store token + fetch profile
 * - logout(): clear token + redirect to /login
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import type { User } from "@/types";
import { getToken, setToken, clearToken, getMe } from "@/lib/api";

// Context shape

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provider

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the current user profile using the stored token
  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await getMe();
      if (res.ok) {
        setUser(res.data);
      } else {
        clearToken();
        setUser(null);
      }
    } catch {
      // Token was invalid / expired - wipe it
      clearToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // On mount, try to restore the session from localStorage token
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Called after a successful login - stores the token, fetches the profile,
  // then navigates to the dashboard.
  const login = useCallback(
    async (token: string) => {
      setToken(token);
      setIsLoading(true);
      try {
        const res = await getMe();
        if (res.ok) {
          setUser(res.data);
          router.push("/dashboard");
        } else {
          clearToken();
          setUser(null);
        }
      } catch {
        clearToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    },
    [router],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
