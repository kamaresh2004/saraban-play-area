import { Sparkles } from "lucide-react";
import { useState } from "react";

import { cn } from "../lib/utils";

interface LogoProps {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const MARK_SIZES = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-10 w-10 rounded-xl",
  lg: "h-12 w-12 rounded-2xl",
};

const WORD_SIZES = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

export function Logo({ variant = "dark", size = "md", className }: LogoProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!imageFailed) {
    return (
      <div className={cn("flex items-center", className)}>
        <img
          src="/logo.png"
          alt="Saraban Play Area"
          className={cn(
            "w-auto object-contain",
            size === "sm" ? "h-8" : size === "md" ? "h-10" : "h-12",
          )}
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative grid place-items-center bg-primary text-white shadow-[0_10px_22px_-10px_rgba(28,147,160,0.9)]",
          MARK_SIZES[size],
        )}
      >
        <Sparkles className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} strokeWidth={2.2} />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber" />
      </span>
      <span
        className={cn(
          "font-extrabold lowercase tracking-[-0.04em]",
          WORD_SIZES[size],
          variant === "light" ? "text-white" : "text-ink",
        )}
      >
        saraban
      </span>
    </div>
  );
}
