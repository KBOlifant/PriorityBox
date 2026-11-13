"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authService from "@/services/auth";
import { clearMailCache } from "@/services/mailCache";
import { clearSavedBodies } from "@/services/savedBodies";
import type { User } from "@/services/auth";

interface AuthValue {
  user: User | null;
  /** True until Firebase has reported the initial auth state. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** React bindings for the auth service: exposes the current user to components. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileVersion, setProfileVersion] = useState(0);

  useEffect(
    () =>
      authService.onAuthChange((u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      signIn: authService.signIn,
      async signUp(name, email, password) {
        await authService.signUp(name, email, password);
        // The profile is edited in place and doesn't fire onAuthStateChanged,
        // so bump a counter to re-render consumers with the new name.
        setProfileVersion((v) => v + 1);
      },
      async signInWithGoogle() {
        await authService.signInWithGoogle();
      },
      resetPassword: authService.resetPassword,
      async signOut() {
        clearMailCache(user?.uid); // cached emails must not outlive the session
        clearSavedBodies(user?.uid); // nor the copies kept of saved emails
        await authService.signOut();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- profileVersion forces a new value after profile edits
    [user, loading, profileVersion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Display details for the signed-in user. */
export function useProfile() {
  const { user } = useAuth();
  const name = user?.displayName?.trim() || user?.email?.split("@")[0] || "there";
  const firstName = name.split(/\s+/)[0];
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return { name, firstName, initials, email: user?.email ?? "" };
}
