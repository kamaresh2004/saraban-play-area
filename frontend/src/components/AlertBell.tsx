import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { clockFromSeconds } from "../lib/format";
import type { LiveResponse } from "../lib/types";
import { cn } from "../lib/utils";

export function AlertBell({ live }: { live?: LiveResponse }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const alerts = (live?.visits ?? []).filter((visit) => visit.alert !== "ok");
  const count = alerts.length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={`Time alerts${count ? `, ${count} open` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "focus-ring relative grid h-10 w-10 place-items-center rounded-xl border bg-white transition",
          count > 0
            ? "border-amber/50 text-amber-dark hover:bg-amber-soft"
            : "border-ink/10 text-ink-muted hover:bg-ink/[0.03] hover:text-ink",
        )}
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {count}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-ink/[0.06] px-4 py-3">
              <div>
                <p className="text-sm font-bold text-ink">Time alerts</p>
                <p className="text-[11px] text-ink-faint">
                  {live ? `${live.warning_count} ending soon · ${live.overdue_count} overdue` : "Checking…"}
                </p>
              </div>
              <Link
                to="/live"
                onClick={() => setOpen(false)}
                className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary hover:text-primary-700"
              >
                Live
              </Link>
            </div>

            {alerts.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-6">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-success-soft text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">All caught up</p>
                  <p className="text-xs text-ink-faint">No children need attention.</p>
                </div>
              </div>
            ) : (
              <ul className="max-h-80 divide-y divide-ink/[0.05] overflow-y-auto">
                {alerts.map((visit) => (
                  <li key={visit.id}>
                    <Link
                      to={`/checkout/${visit.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-tint/60"
                    >
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          visit.alert === "overdue" ? "bg-danger" : "bg-amber",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-ink">
                          {visit.child_name}
                        </p>
                        <p
                          className={cn(
                            "text-[11px] font-medium",
                            visit.alert === "overdue" ? "text-danger" : "text-amber-dark",
                          )}
                        >
                          {visit.alert === "overdue"
                            ? `Overdue by ${clockFromSeconds(-visit.remaining_seconds)}`
                            : `${clockFromSeconds(visit.remaining_seconds)} left`}
                          <span className="font-normal text-ink-faint"> · {visit.plan_name}</span>
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
