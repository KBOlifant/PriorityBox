import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";

// Neu Prompter: licensed for personal use (see assets/neu-prompter/*eula.txt).
const neuPrompter = localFont({
  variable: "--font-neu-prompter",
  display: "swap",
  src: [
    { path: "../assets/neu-prompter/NeuPrompter-Light.otf", weight: "300", style: "normal" },
    { path: "../assets/neu-prompter/NeuPrompter-Regular.otf", weight: "400", style: "normal" },
    { path: "../assets/neu-prompter/NeuPrompter-Medium.otf", weight: "500", style: "normal" },
    { path: "../assets/neu-prompter/NeuPrompter-SemiBold.otf", weight: "600", style: "normal" },
    { path: "../assets/neu-prompter/NeuPrompter-Bold.otf", weight: "700", style: "normal" },
    { path: "../assets/neu-prompter/NeuPrompter-ExtraBold.otf", weight: "800", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Priority",
  description: "A calmer inbox that surfaces the messages that move work forward.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${neuPrompter.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas font-sans text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
