import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Sparkles,
  BookOpen,
  Users,
  HelpCircle,
  Wrench,
  Settings,
  Briefcase,
  Upload,
  CheckCircle2,
  FolderOpen,
  ShieldCheck,
  LogOut,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, initialsOf } from "@/lib/profile";
import markUrl from "@/assets/onboardie-mark.png";

const newHireNav = [
  { to: "/", label: "Your Onboarding Dashboard", icon: LayoutDashboard },
  { to: "/ai-coach", label: "Chat with Your AI Coach", icon: Sparkles },
  { to: "/learning-plan", label: "Learning Plan", icon: BookOpen },
  { to: "/resources", label: "Resources and Tools", icon: Wrench },
  { to: "/contacts", label: "Who to Contact", icon: Users },
  { to: "/role-overview", label: "Role Overview & Q&A", icon: HelpCircle },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const managerNav = [
  { to: "/manager", label: "Manager Dashboard", icon: Briefcase },
  { to: "/upload-content", label: "Upload Role Content", icon: Upload },
  { to: "/review-approve", label: "Review & Approve", icon: CheckCircle2 },
  { to: "/manage-content", label: "Manage Content", icon: FolderOpen },
] as const;

const managerPaths = managerNav.map((i) => i.to as string);

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { profile } = useProfile();
  const [signingOut, setSigningOut] = useState(false);

  // The current route decides the portal, so toggling navigates instantly.
  const isManager = managerPaths.includes(pathname);
  const items = isManager ? managerNav : newHireNav;
  const name = profile?.full_name?.trim() || profile?.email || "Your account";

  async function handleLogout() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out failed", err);
    }
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* storage may be unavailable */
    }
    window.location.href = "/login";
  }

  const renderLink = ({
    to,
    label,
    icon: Icon,
  }: {
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
  }) => {
    const active = pathname === to;
    return (
      <Link
        key={to}
        to={to}
        className={
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
          (active
            ? isManager
              ? "bg-manager text-manager-foreground"
              : "bg-primary text-primary-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground min-h-screen sticky top-0">
      <div className="px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-card p-1.5">
            <img src={markUrl} alt="Onboardie" className="h-full w-full object-contain" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Onboardie</span>
        </div>
      </div>

      {/* Portal toggle — temporary prototype convenience */}
      <div className="px-4">
        <div className="flex rounded-xl bg-sidebar-accent/40 p-1">
          <Link
            to="/"
            className={
              "flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium transition-colors " +
              (!isManager
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground")
            }
          >
            New Hire View
          </Link>
          <Link
            to="/manager"
            className={
              "flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium transition-colors " +
              (isManager
                ? "bg-manager text-manager-foreground shadow-sm"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground")
            }
          >
            Manager View
          </Link>
        </div>
        {isManager && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-manager/40 bg-manager/15 px-2.5 py-1.5 text-[11px] font-medium text-manager">
            <ShieldCheck className="h-3.5 w-3.5" />
            Manager portal
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          {isManager ? "Manager" : "New Hire"}
        </div>
        <div className="space-y-1">{items.map(renderLink)}</div>
      </nav>

      {/* Account row: profile on the left, log out on the right */}
      <div className="border-t border-sidebar-accent/40 p-3">
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            title="Your profile"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initialsOf(profile?.full_name ?? "")}
            </span>
            <span className="min-w-0 truncate text-xs font-medium text-sidebar-foreground/80">
              {name}
            </span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            aria-label="Log out"
            title="Log out"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
