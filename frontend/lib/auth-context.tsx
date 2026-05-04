"use client";

/*
 * Auth Context - shared authentication state for the whole app.
 *
 * Provides:
 * - user: current User object (null while loading / logged out)
 * - isLoading: true while checking the token on mount
 * - isAuthenticated: shorthand for !!user
 * - login(): fetch profile and navigate
 * - logout(): clear token + redirect to /login
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import type { User } from "@/types";
import { clearToken, getMe, logout as apiLogout } from "@/lib/api";

// Context shape

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provider

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authRequestIdRef = useRef(0);

  const beginAuthRequest = useCallback(() => {
    authRequestIdRef.current += 1;
    return authRequestIdRef.current;
  }, []);

  const isLatestAuthRequest = useCallback((requestId: number) => {
    return authRequestIdRef.current === requestId;
  }, []);

  // Fetch the current user profile via the HttpOnly cookie (sent automatically)
  const fetchUser = useCallback(async () => {
    const requestId = beginAuthRequest();

    try {
      const res = await getMe();
      if (!isLatestAuthRequest(requestId)) {
        return;
      }

      if (res.ok) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch {
      if (!isLatestAuthRequest(requestId)) {
        return;
      }

      setUser(null);
    } finally {
      if (isLatestAuthRequest(requestId)) {
        setIsLoading(false);
      }
    }
  }, [beginAuthRequest, isLatestAuthRequest]);

  // On mount, try to restore the session via HttpOnly cookie
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Called after a successful login - the backend already set the HttpOnly cookie;
  // we just fetch the profile and navigate to the dashboard.
  const login = useCallback(
    async (): Promise<boolean> => {
      const requestId = beginAuthRequest();
      setIsLoading(true);

      try {
        const res = await getMe();
        if (!isLatestAuthRequest(requestId)) {
          return false;
        }

        if (res.ok) {
          setUser(res.data);
          router.replace("/dashboard");
          return true;
        } else {
          clearToken();
          setUser(null);
          throw new Error(
            "Login succeeded but session could not be restored. Enable third-party cookies or try another browser.",
          );
        }
      } catch {
        if (!isLatestAuthRequest(requestId)) {
          return false;
        }

        clearToken();
        setUser(null);
        throw new Error(
          "Login succeeded but session could not be restored. Enable third-party cookies or try another browser.",
        );
      } finally {
        if (isLatestAuthRequest(requestId)) {
          setIsLoading(false);
        }
      }
    },
    [beginAuthRequest, isLatestAuthRequest, router],
  );

  const logout = useCallback(async () => {
    beginAuthRequest();
    await apiLogout();
    setUser(null);
    router.push("/login");
  }, [beginAuthRequest, router]);

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
