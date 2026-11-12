"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Splash } from "@/components/auth-gate";
import { LogoMark } from "@/components/logo";
import { authErrorMessage, useAuth } from "@/lib/auth";

type Mode = "login" | "signup";

const inputClass =
  "h-12 w-full rounded-xl border border-line bg-surface px-4 text-[14px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent-line focus:ring-2 focus:ring-accent/20";
const labelClass = "mb-2 block text-[12px] font-medium text-body";

export default function LoginPage() {
  const { user, loading, signIn, signUp, signInWithGoogle, resetPassword } =
    useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  if (loading || user) return <Splash />;

  const isSignup = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    void run(() =>
      isSignup
        ? signUp(name.trim(), email.trim(), password)
        : signIn(email.trim(), password),
    );
  }

  function onForgot() {
    if (!email.trim()) {
      setError("Enter your email above, then choose “Forgot password”.");
      setNotice("");
      return;
    }
    void run(async () => {
      await resetPassword(email.trim());
      setNotice("Password reset email sent. Check your inbox.");
    });
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-20%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]"
      />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-[440px] rounded-[28px] border border-line bg-[#171719] p-8 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] sm:p-10"
      >
        <div className="flex items-center gap-3">
          <LogoMark size={34} />
          <span className="text-[15px] font-semibold tracking-tight">
            Priority
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Authentication mode"
          className="mt-8 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1"
        >
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`relative h-9 rounded-lg text-[13px] font-medium transition-colors ${
                mode === m ? "text-accent-text" : "text-muted hover:text-ink"
              }`}
            >
              {mode === m && (
                <motion.span
                  layoutId="auth-tab"
                  className="absolute inset-0 rounded-lg bg-accent-soft"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative">
                {m === "login" ? "Log in" : "Sign up"}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <h1 className="mt-7 text-[28px] font-semibold leading-[1.15] tracking-[-0.03em]">
              {isSignup ? "Create your account." : "Welcome back."}
            </h1>
            <p className="mt-3 text-[14px] leading-6 text-body">
              {isSignup
                ? "Set up Priority to focus on the messages that move work forward."
                : "Log in to pick up where you left off."}
            </p>
          </motion.div>
        </AnimatePresence>

        <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
          <AnimatePresence initial={false}>
            {isSignup && (
              <motion.div
                key="name"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <label htmlFor="name" className={labelClass}>
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  required={isSignup}
                  className={inputClass}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className={inputClass}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="password" className="text-[12px] font-medium text-body">
                Password
              </label>
              {!isSignup && (
                <button
                  type="button"
                  onClick={onForgot}
                  className="text-[12px] text-muted transition-colors hover:text-accent-text"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? "At least 6 characters" : "Your password"}
                required
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:text-ink"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {(error || notice) && (
              <motion.div
                key={error || notice}
                role={error ? "alert" : "status"}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <p
                  className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-[13px] leading-5 ${
                    error
                      ? "border-[#5a2a25] bg-[#2d1613] text-[#f0a090]"
                      : "border-[#2f4a3c] bg-[#14211b] text-[#9fd0b4]"
                  }`}
                >
                  {error ? (
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  )}
                  {error || notice}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={busy}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-70"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {isSignup ? "Create account" : "Log in"}
          </motion.button>
        </form>

        <div className="my-6 flex items-center gap-4 text-[11px] uppercase tracking-[0.18em] text-muted">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <motion.button
          type="button"
          disabled={busy}
          onClick={() => void run(signInWithGoogle)}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface text-[14px] font-medium transition-colors hover:border-[#38383d] disabled:opacity-70"
        >
          <GoogleMark />
          Continue with Google
        </motion.button>

        <p className="mt-7 text-center text-[13px] text-muted">
          {isSignup ? "Already have an account?" : "New to Priority?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(isSignup ? "login" : "signup")}
            className="font-medium text-accent-text hover:underline"
          >
            {isSignup ? "Log in" : "Create an account"}
          </button>
        </p>
      </motion.div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
