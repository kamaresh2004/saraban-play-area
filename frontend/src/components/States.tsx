import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { Button } from "./Button";

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink/10 bg-white/60 p-8 text-center",
        className,
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-tint text-primary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </span>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-danger/15 bg-danger-soft/50 p-8 text-center",
        className,
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-danger shadow-sm">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {message ? (
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-muted">
            {message}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink/10 bg-white/60 p-8 text-center",
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-tint text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {message ? (
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-ink-muted">
            {message}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
