import {
  CalendarCheck,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Radio,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { AlertBell } from "../components/AlertBell";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Modal } from "../components/Dialog";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useLive, useTick } from "../hooks/useLive";
import { IST, initials, timeOf, weekdayDate } from "../lib/format";
import type { Role } from "../lib/types";
import { cn } from "../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { to: "/live", label: "Live floor", icon: Radio },
  { to: "/check-in", label: "Check in", icon: QrCode },
  { to: "/children", label: "Children", icon: Users },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

const DESKTOP_EXTRA: NavItem[] = [];

function visibleItems(role: Role | undefined): NavItem[] {
  return [...NAV_ITEMS, ...DESKTOP_EXTRA].filter((item) => !item.adminOnly || role === "admin");
}

function SidebarLink({
  item,
  alertCount,
  onNavigate,
}: {
  item: NavItem;
  alertCount: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition",
          isActive
            ? "bg-tint text-primary-800"
            : "text-ink-muted hover:bg-ink/[0.035] hover:text-ink",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary transition-opacity",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
          <Icon
            className={cn(
              "h-[18px] w-[18px] transition",
              isActive ? "text-primary" : "text-ink-faint group-hover:text-ink-muted",
            )}
            strokeWidth={2}
          />
          <span className="flex-1">{item.label}</span>
          {item.to === "/live" && alertCount > 0 ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {alertCount}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const live = useLive(20000);
  const tick = useTick(20000);
  const knownAlerts = useRef<Set<string> | null>(null);

  const items = visibleItems(user?.role);
  const alertCount = (live.data?.warning_count ?? 0) + (live.data?.overdue_count ?? 0);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!live.data) return;
    const alerts = live.data.visits.filter((visit) => visit.alert !== "ok");
    const keys = new Set(alerts.map((visit) => `${visit.id}:${visit.alert}`));

    if (knownAlerts.current === null) {
      knownAlerts.current = keys;
      if (alerts.length) {
        const overdue = alerts.filter((visit) => visit.alert === "overdue").length;
        toast(
          "warning",
          `${alerts.length} child${alerts.length === 1 ? "" : "ren"} need attention`,
          overdue
            ? `${overdue} overdue. Open the live floor to check out or extend.`
            : "Less than 10 minutes of play time left.",
        );
      }
      return;
    }

    const added = alerts.filter(
      (visit) => !knownAlerts.current?.has(`${visit.id}:${visit.alert}`),
    );
    knownAlerts.current = keys;
    added.slice(0, 2).forEach((visit) => {
      toast(
        visit.alert === "overdue" ? "error" : "warning",
        visit.alert === "overdue"
          ? `${visit.child_name} is overdue`
          : `${visit.child_name} has 10 minutes left`,
        `${visit.plan_name} · ${visit.parent_name}`,
      );
    });
  }, [live.data, toast]);

  const now = new Date(tick);
  const clockLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
  const dateLabel = weekdayDate(now.toISOString());
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: IST,
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen">
      {/* Desktop / tablet sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-ink/[0.06] bg-white/85 backdrop-blur md:flex">
        <div className="px-6 pb-5 pt-6">
          <Logo size="md" />
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            Indoor play · Kolkata
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
            Workspace
          </p>
          {items.map((item) => (
            <SidebarLink key={item.to} item={item} alertCount={alertCount} />
          ))}

          <div className="mx-3 my-4 h-px bg-ink/[0.06]" />

          <div className="mx-3 rounded-2xl border border-ink/[0.06] bg-[#FAFCFC] p-3.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-muted">
                Front desk live
              </p>
            </div>
            <p className="tabular mt-1.5 text-[13px] font-semibold text-ink">{clockLabel}</p>
            <p className="text-[11px] text-ink-faint">{dateLabel} · IST</p>
          </div>
        </nav>

        <div className="border-t border-ink/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-[11px] font-bold text-white">
              {initials(user?.full_name ?? "S")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{user?.full_name}</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {user?.role === "admin" ? "Owner" : "Reception"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              onClick={handleLogout}
              className="focus-ring rounded-lg p-2 text-ink-faint transition hover:bg-danger-soft hover:text-danger"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="md:pl-[264px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-ink/[0.05] bg-[#F4F8F9]/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="md:hidden">
                <Logo size="sm" />
              </div>
              <div className="hidden min-w-0 md:block">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {greeting}, {user?.full_name.split(" ")[0]}
                </p>
                <p className="text-[11px] text-ink-faint">{dateLabel}</p>
              </div>
              <div className="hidden items-center gap-2 sm:flex md:hidden">
                <Badge tone="primary" dot>
                  Front desk
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="tabular hidden items-center gap-1.5 rounded-xl border border-ink/10 bg-white px-3 py-2 text-[12px] font-semibold text-ink-muted sm:flex">
                <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                {clockLabel}
              </span>
              <AlertBell live={live.data} />
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="focus-ring grid h-10 w-10 place-items-center rounded-xl border border-ink/10 bg-white text-ink-muted transition hover:bg-ink/[0.03] md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1.5">
          {(user?.role === "admin"
            ? [
                NAV_ITEMS[0],
                NAV_ITEMS[1],
                NAV_ITEMS[2],
                NAV_ITEMS[3],
                NAV_ITEMS[4],
              ]
            : [NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[3], NAV_ITEMS[4]]
          ).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition",
                    isActive ? "text-primary-700" : "text-ink-faint",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "grid h-8 w-11 place-items-center rounded-xl transition",
                        isActive ? "bg-tint" : "bg-transparent",
                      )}
                    >
                      <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.4 : 2} />
                    </span>
                    <span className="leading-none">{item.label}</span>
                    {item.to === "/live" && alertCount > 0 ? (
                      <span className="absolute right-[22%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                        {alertCount}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Full menu (phones/tablets) */}
      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menu"
        description="Navigate the front desk."
        size="sm"
      >
        <div className="space-y-1">
          {items.map((item) => (
            <SidebarLink
              key={item.to}
              item={item}
              alertCount={alertCount}
              onNavigate={() => setMenuOpen(false)}
            />
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-ink/[0.06] bg-[#FAFCFC] p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-[12px] font-bold text-white">
              {initials(user?.full_name ?? "S")}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{user?.full_name}</p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                {user?.role === "admin" ? "Owner" : "Reception"}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            fullWidth
            className="mt-3"
            onClick={handleLogout}
            leftIcon={<LogOut className="h-4 w-4" />}
          >
            Sign out
          </Button>
        </div>
        <p className="mt-4 text-center text-[11px] text-ink-faint">
          {timeOf(now.toISOString())} IST · {dateLabel}
        </p>
      </Modal>
    </div>
  );
}
