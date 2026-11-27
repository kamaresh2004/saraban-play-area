import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "ink";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-ink/10 bg-ink/[0.04] text-ink-muted",
  primary: "border-primary/15 bg-tint text-primary-700",
  success: "border-success/15 bg-success-soft text-success-dark",
  warning: "border-amber/40 bg-amber-soft text-amber-dark",
  danger: "border-danger/15 bg-danger-soft text-danger-dark",
  ink: "border-ink bg-ink text-white",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "danger"
              ? "bg-danger"
              : tone === "warning"
                ? "bg-amber-dark"
                : tone === "success"
                  ? "bg-success"
                  : tone === "primary"
                    ? "bg-primary"
                    : "bg-ink-faint",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
