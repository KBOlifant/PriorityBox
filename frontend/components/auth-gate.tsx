"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogoMark } from "./logo";
import { useAuth } from "@/lib/auth";

export function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.96, 1, 0.96] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <LogoMark size={44} />
      </motion.div>
    </div>
  );
}

/** Renders children only for signed-in users; everyone else goes to /login. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return <Splash />;
  return <>{children}</>;
}
