import { AuthGate } from "@/components/auth-gate";
import { AiFilterChip, MailBanner, MailSync, ManualHint, ManualSync, SavedSync } from "@/components/mail-sync";
import { ManualEditor } from "@/components/manual-editor";
import { Pagination } from "@/components/pagination";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { Onboarding } from "@/components/onboarding";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-6 pb-20 pt-10 lg:px-8">
            <div className="mx-auto w-full max-w-[1160px]">
              <MailBanner />
              <AiFilterChip />
              <ManualHint />
              {children}
              <Pagination />
            </div>
          </main>
        </div>
        <Onboarding />
        <MailSync />
        <SavedSync />
        <ManualSync />
        <ManualEditor />
      </div>
    </AuthGate>
  );
}
