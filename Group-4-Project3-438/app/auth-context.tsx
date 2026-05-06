import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Linking } from "react-native";
import * as ExpoLinking from "expo-linking";

export type AuthUser = {
  authenticated: boolean;
  name?: string | null;
  email?: string | null;
  userId?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
};

const BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ??
  "https://cardfetcherapi.onrender.com";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/auth/me`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Auth status failed with ${response.status}`);
  }
  return response.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  function hydrateFromCallbackUrl(url: string | null): boolean {
    if (!url) return false;
    const parsed = ExpoLinking.parse(url);
    const auth = parsed.queryParams?.auth;
    const userIdParam = parsed.queryParams?.userId;
    if (auth !== "success" || typeof userIdParam !== "string" || !userIdParam.trim()) {
      return false;
    }

    const nameParam = parsed.queryParams?.name;
    const emailParam = parsed.queryParams?.email;
    setUser({
      authenticated: true,
      userId: userIdParam.trim(),
      name: typeof nameParam === "string" ? nameParam : null,
      email: typeof emailParam === "string" ? emailParam : null,
    });
    setLoading(false);
    return true;
  }

  async function refreshAuth() {
    try {
      const nextUser = await fetchCurrentUser();
      setUser(nextUser);
    } catch {
      setUser((prev) => (prev?.authenticated ? prev : { authenticated: false }));
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await fetch(`${BACKEND_BASE_URL}/logout`, {
      method: "POST",
      credentials: "include",
    });
    await refreshAuth();
  }

  useEffect(() => {
    async function bootstrapAuth() {
      const initialUrl = await Linking.getInitialURL();
      const hydrated = hydrateFromCallbackUrl(initialUrl);
      if (!hydrated) {
        await refreshAuth();
      }
    }
    bootstrapAuth();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshAuth();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      const hydrated = hydrateFromCallbackUrl(url);
      if (!hydrated) {
        refreshAuth();
      }
    });
    return () => sub.remove();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      refreshAuth,
      signOut,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
