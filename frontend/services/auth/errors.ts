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
