import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, Package, Calculator, ShoppingBasket, Settings, Plus } from "lucide-react";
import type { ReactNode } from "react";

type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/stock", label: "Stock", icon: Package },
  { to: "/calculator", label: "Calc", icon: Calculator },
  { to: "/grocery", label: "Grocery", icon: ShoppingBasket },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  title,
  subtitle,
  children,
  showFab = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  showFab?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen pb-28">
      <header className="px-5 pt-8 pb-5">
        <h1 className="font-display text-3xl font-extrabold text-secondary">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </header>

      <main className="px-5">{children}</main>

      {showFab && (
        <button
          type="button"
          aria-label="Quick add"
          className="press fixed right-5 bottom-24 z-40 grid h-14 w-14 place-items-center rounded-full gradient-warm shadow-[var(--shadow-pop)]"
        >
          <Plus className="h-7 w-7" strokeWidth={2.5} />
        </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 pt-2">
        <div className="glass mx-auto flex max-w-lg items-center justify-between gap-1 px-2 py-2">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={[
                  "press pill flex flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-semibold",
                  active ? "gradient-warm text-primary-foreground" : "text-foreground/70",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span className="leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
