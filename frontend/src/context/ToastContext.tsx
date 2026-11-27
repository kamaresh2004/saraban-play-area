import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "../lib/utils";

export type ToastKind = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} satisfies Record<ToastKind, typeof Info>;

const TONES: Record<ToastKind, string> = {
  success: "text-success",
  error: "text-danger",
  warning: "text-amber-dark",
  info: "text-primary",
};

const BARS: Record<ToastKind, string> = {
  success: "bg-success",
  error: "bg-danger",
  warning: "bg-amber",
  info: "bg-primary",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-3), { id, kind, title, message }]);
      window.setTimeout(() => dismiss(id), 5200);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, message) => toast("success", title, message),
      error: (title, message) => toast("error", title, message),
      warning: (title, message) => toast("warning", title, message),
      info: (title, message) => toast("info", title, message),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[130] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:w-[390px]">
        <AnimatePresence initial={false}>
          {toasts.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="pointer-events-auto relative overflow-hidden rounded-2xl border border-ink/10 bg-white p-4 pr-11 shadow-lift"
              >
                <span
                  className={cn("absolute inset-y-0 left-0 w-1", BARS[item.kind])}
                />
                <div className="flex items-start gap-3">
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", TONES[item.kind])} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    {item.message ? (
                      <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">
                        {item.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(item.id)}
                  className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-ink-faint transition hover:bg-ink/5 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
