import type { ReactNode } from "react";
import { AppSidebar, MobileNav } from "./app-sidebar";
import { PreviewBanner } from "./preview-banner";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground md:flex-row">
      <MobileNav />
      <AppSidebar />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-12">
        <PreviewBanner />
        {children}
      </main>
    </div>
  );
}
