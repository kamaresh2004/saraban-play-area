import { motion } from "framer-motion";
import { ArrowRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "../../components/Badge";
import { clockFromSeconds, initials, minutesDuration, money, timeOf } from "../../lib/format";
import type { LiveVisit } from "../../lib/types";
import { cn } from "../../lib/utils";

export function LiveCard({
  visit,
  driftSeconds,
}: {
  visit: LiveVisit;
  driftSeconds: number;
}) {
  const remaining = visit.remaining_seconds - driftSeconds;
  const elapsedSeconds = visit.elapsed_seconds + driftSeconds;
  const alert =
    remaining < 0 ? "overdue" : remaining <= 10 * 60 ? "warning" : "ok";
  const progress = Math.min(
    100,
    Math.max(0, (elapsedSeconds / Math.max(1, visit.booked_minutes * 60)) * 100),
  );

  const shell =
    alert === "overdue"
      ? "border-danger/30 bg-gradient-to-br from-danger-soft/70 via-white to-white"
      : alert === "warning"
        ? "border-amber/60 bg-gradient-to-br from-amber-soft/80 via-white to-white"
        : "border-ink/[0.07] bg-white hover:border-primary/30";

  const avatar =
    alert === "overdue"
      ? "bg-danger-soft text-danger-dark"
      : alert === "warning"
        ? "bg-amber-soft text-amber-dark"
        : "bg-tint text-primary-700";

  const bar =
    alert === "overdue" ? "bg-danger" : alert === "warning" ? "bg-amber" : "bg-primary";

  return (
    <motion.div layout transition={{ type: "spring", stiffness: 320, damping: 32 }}>
      <Link
        to={`/checkout/${visit.id}`}
        className={cn(
          "group block overflow-hidden rounded-2xl border p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift",
          shell,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold",
                avatar,
              )}
            >
              {initials(visit.child_name)}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink">
                {visit.child_name}
              </h3>
              <p className="truncate text-xs text-ink-muted">
                Age {visit.child_age} · {visit.plan_name}
              </p>
            </div>
          </div>
          <Badge
            tone={alert === "overdue" ? "danger" : alert === "warning" ? "warning" : "success"}
            dot
          >
            {alert === "overdue" ? "Overdue" : alert === "warning" ? "Ending soon" : "Playing"}
          </Badge>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="label">
              {alert === "overdue" ? "Overdue by" : "Time left"}
            </p>
            <p
              className={cn(
                "tabular mt-1 text-[34px] font-extrabold leading-none tracking-[-0.04em]",
                alert === "overdue"
                  ? "text-danger"
                  : alert === "warning"
                    ? "text-amber-dark"
                    : "text-ink",
              )}
            >
              {clockFromSeconds(alert === "overdue" ? Math.abs(remaining) : remaining)}
            </p>
          </div>
          <div className="text-right">
            <p className="label">Checked in</p>
            <p className="tabular mt-1 text-sm font-semibold text-ink">
              {timeOf(visit.check_in_at)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">{money(visit.plan_price)} plan</p>
          </div>
        </div>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700", bar)}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-ink/[0.06] pt-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-faint">
            <Clock3 className="h-3.5 w-3.5" />
            Played {minutesDuration(elapsedSeconds / 60)}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-700">
            Check out
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
