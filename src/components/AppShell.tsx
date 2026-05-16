import { Link, useLocation } from "@tanstack/react-router";
import { Ship, LayoutDashboard, Bell, Package, MessageSquare, Settings, CreditCard } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Monitored products", icon: Package },
  { to: "/ask", label: "Ask ClearPort", icon: MessageSquare },
  { to: "/preferences", label: "Alert preferences", icon: Bell },
  { to: "/pricing", label: "Plan & billing", icon: CreditCard },
  { to: "/onboarding", label: "Setup", icon: Settings },
] as const;

export function AppShell({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-white md:flex md:flex-col">
        <Link to="/" className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Ship className="h-4 w-4" />
          </div>
          <span className="font-semibold">ClearPort</span>
        </Link>
        <nav className="flex-1 space-y-1 p-3 text-sm">
          {nav.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                  active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          Source-backed summaries. Verify with your customs broker.
        </div>
      </aside>
      <div className="md:pl-60">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-white/80 px-4 backdrop-blur sm:px-8">
          <div>
            {title && <h1 className="text-lg font-semibold tracking-tight">{title}</h1>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Logged in as</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">JS</div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}