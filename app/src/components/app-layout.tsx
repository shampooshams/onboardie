import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { PreviewBanner } from "./preview-banner";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <main className="flex-1 px-6 py-8 md:px-10 md:py-12 max-w-6xl mx-auto w-full">
        <PreviewBanner />
        {children}
      </main>
    </div>
  );
}
