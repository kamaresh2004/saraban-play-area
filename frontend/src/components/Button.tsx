import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "amber"
  | "success";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-[0_12px_24px_-12px_rgba(28,147,160,0.9)] hover:bg-primary-600 active:bg-primary-700",
  secondary:
    "border border-ink/10 bg-white text-ink shadow-sm hover:border-ink/20 hover:bg-ink/[0.02]",
  ghost: "text-ink-muted hover:bg-ink/[0.05] hover:text-ink",
  danger:
    "bg-danger text-white shadow-[0_12px_24px_-12px_rgba(220,38,38,0.9)] hover:bg-danger-dark",
  amber: "bg-amber text-ink shadow-sm hover:brightness-[0.97]",
  success:
    "bg-success text-white shadow-[0_12px_24px_-12px_rgba(22,163,74,0.9)] hover:bg-success-dark",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3 text-[13px]",
  md: "h-11 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-5 text-[15px]",
  xl: "h-14 gap-2.5 rounded-2xl px-7 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center font-semibold transition-all duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : leftIcon}
      {children}
      {!loading ? rightIcon : null}
    </button>
  );
}
