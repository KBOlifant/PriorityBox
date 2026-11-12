"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileVersion, setProfileVersion] = useState(0);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signUp(name, email, password) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        // updateProfile mutates the user in place and doesn't fire
        // onAuthStateChanged, so bump a counter to re-render consumers.
        setProfileVersion((v) => v + 1);
      },
      async signInWithGoogle() {
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      resetPassword: (email) => sendPasswordResetEmail(auth, email),
      signOut: () => firebaseSignOut(auth),
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

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don’t match.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "That email and password don’t match.",
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/weak-password": "Use at least 6 characters for your password.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Can’t reach the server. Check your connection.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/cancelled-popup-request": "Sign-in was cancelled.",
  "auth/operation-not-allowed":
    "This sign-in method isn’t enabled in Firebase yet.",
};

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  return MESSAGES[code] ?? "Something went wrong. Please try again.";
}
