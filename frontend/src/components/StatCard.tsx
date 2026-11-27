import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";

type Tone = "primary" | "amber" | "danger" | "success" | "ink";

const TONES: Record<Tone, { icon: string; value: string }> = {
  primary: { icon: "bg-tint text-primary", value: "text-ink" },
  amber: { icon: "bg-amber-soft text-amber-dark", value: "text-ink" },
  danger: { icon: "bg-danger-soft text-danger", value: "text-danger" },
  success: { icon: "bg-success-soft text-success", value: "text-ink" },
  ink: { icon: "bg-ink/[0.05] text-ink", value: "text-ink" },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("card flex items-start gap-4 p-5", className)}>
      <span
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
          TONES[tone].icon,
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2.1} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-muted">
          {label}
        </p>
        <p
          className={cn(
            "tabular mt-1 text-[26px] font-extrabold leading-none tracking-[-0.03em]",
            TONES[tone].value,
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-1.5 text-xs leading-snug text-ink-faint">{hint}</p> : null}
      </div>
    </div>
  );
}
