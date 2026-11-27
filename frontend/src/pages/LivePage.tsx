import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Plus,
  Radio,
  RefreshCw,
  ScanLine,
  Search,
  Timer,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Modal } from "../components/Dialog";
import { Input } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { QrScanner } from "../components/QrScanner";
import { EmptyState, ErrorState } from "../components/States";
import { useToast } from "../context/ToastContext";
import { LiveCard } from "../features/live/LiveCard";
import { useLive, useTick } from "../hooks/useLive";
import { api } from "../lib/api";
import { clockFromSeconds, timeOf } from "../lib/format";
import { cn } from "../lib/utils";

type Filter = "all" | "warning" | "overdue";

export function LivePage() {
  const live = useLive(15000);
  const tick = useTick(1000);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, warning, error: toastError } = useToast();

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);

  const driftSeconds = live.dataUpdatedAt
    ? Math.max(0, (tick - live.dataUpdatedAt) / 1000)
    : 0;

  const enriched = useMemo(() => {
    const visits = live.data?.visits ?? [];
    return visits
      .map((visit) => {
        const remaining = visit.remaining_seconds - driftSeconds;
        const alert =
          remaining < 0 ? "overdue" : remaining <= 600 ? "warning" : "ok";
        return { visit, remaining, alert } as const;
      })
      .sort((a, b) => a.remaining - b.remaining);
  }, [live.data, driftSeconds]);

  const counts = {
    inside: enriched.length,
    warning: enriched.filter((item) => item.alert === "warning").length,
    overdue: enriched.filter((item) => item.alert === "overdue").length,
  };

  const term = search.trim().toLowerCase();
  const filtered = enriched.filter(({ visit, alert }) => {
    if (filter !== "all" && alert !== filter) return false;
    if (!term) return true;
    return (
      visit.child_name.toLowerCase().includes(term) ||
      visit.parent_name.toLowerCase().includes(term) ||
      visit.phone.includes(term) ||
      visit.plan_name.toLowerCase().includes(term)
    );
  });

  const handleScan = async (text: string) => {
    setLookupBusy(true);
    try {
      const child = await api.getChildByQr(text);
      if (child.active_visit) {
        setScanOpen(false);
        success("QR matched", `${child.name} · ${child.active_visit.plan_name}`);
        navigate(`/checkout/${child.active_visit.id}`);
      } else {
        warning("Not inside right now", `${child.name} has no active visit to check out.`);
      }
    } catch (err) {
      toastError("QR code not recognised", (err as Error).message);
    } finally {
      setLookupBusy(false);
    }
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["live"] });
  };

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Live floor"
        title="Children inside"
        description="Sorted by least time left. Timers update every second from server times; cards turn amber at 10 minutes and red when overdue."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setScanOpen(true)}
              leftIcon={<ScanLine className="h-4 w-4" />}
            >
              Scan to check out
            </Button>
            <Button
              onClick={() => navigate("/check-in")}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Check in
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {[
          {
            label: "Inside now",
            value: counts.inside,
            icon: Users,
            tone: "text-primary-700 bg-tint",
          },
          {
            label: "Ending soon",
            value: counts.warning,
            icon: Timer,
            tone: "text-amber-dark bg-amber-soft",
          },
          {
            label: "Overdue",
            value: counts.overdue,
            icon: AlertTriangle,
            tone: "text-danger bg-danger-soft",
          },
        ].map((item) => (
          <div key={item.label} className="card flex items-center gap-3 p-3.5 sm:p-4">
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10", item.tone)}>
              <item.icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:text-[11px]">
                {item.label}
              </p>
              <p className="tabular text-xl font-extrabold leading-none text-ink sm:text-2xl">
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {counts.overdue > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-danger/20 bg-danger-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-danger shadow-sm">
              <AlertTriangle className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-[13px] font-bold text-danger-dark">
                {counts.overdue} child{counts.overdue === 1 ? " is" : "ren are"} past their
                booked time
              </p>
              <p className="text-[11.5px] text-danger-dark/70">
                Overtime is added after the grace period. Open a card to settle the bill.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setFilter("overdue")}
            className="shrink-0"
          >
            Show overdue
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: "all", label: `All (${counts.inside})` },
              { key: "warning", label: `Ending soon (${counts.warning})` },
              { key: "overdue", label: `Overdue (${counts.overdue})` },
            ] as const
          ).map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition",
                filter === chip.key
                  ? "border-primary bg-primary text-white"
                  : "border-ink/10 bg-white text-ink-muted hover:border-primary/30 hover:text-ink",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or phone"
              className="h-10 pl-10 text-[13px]"
              aria-label="Search live children"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={refresh}
            loading={live.isFetching && !live.isLoading}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            className="h-10 shrink-0"
          >
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {live.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card space-y-4 p-5">
              <div className="flex items-center gap-3">
                <div className="skeleton h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-32" />
                  <div className="skeleton h-2.5 w-24" />
                </div>
              </div>
              <div className="skeleton h-10 w-36" />
              <div className="skeleton h-1.5 w-full" />
            </div>
          ))}
        </div>
      ) : live.isError ? (
        <ErrorState
          title="Live floor unavailable"
          message={(live.error as Error).message}
          onRetry={() => void live.refetch()}
        />
      ) : enriched.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="The play area is quiet"
          message="No children are checked in right now. Scan a QR pass or use check-in to start the first timer."
          action={
            <Button onClick={() => navigate("/check-in")} leftIcon={<Plus className="h-4 w-4" />}>
              Check in a child
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching children"
          message="Try a different name, phone number or filter."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {filtered.map(({ visit }) => (
              <LiveCard key={visit.id} visit={visit} driftSeconds={driftSeconds} />
            ))}
          </div>
          <div className="flex flex-col items-start justify-between gap-2 pt-1 text-[11px] text-ink-faint sm:flex-row sm:items-center">
            <span>
              Last synced{" "}
              {live.dataUpdatedAt
                ? new Intl.DateTimeFormat("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  }).format(new Date(live.dataUpdatedAt))
                : "—"}{" "}
              · auto-refreshes every 15 seconds
            </span>
            <span>
              Server time {live.data ? timeOf(live.data.server_now) : "—"} IST
              {live.data?.clock_offset_minutes
                ? ` · demo clock +${live.data.clock_offset_minutes} min`
                : ""}
            </span>
          </div>
        </>
      )}

      <Modal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Scan to check out"
        description="Point the camera at the child's QR pass. Their live card opens automatically."
        size="sm"
      >
        <QrScanner onScan={handleScan} disabled={lookupBusy} />
        <p className="mt-4 rounded-xl bg-ink/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-ink-muted">
          No camera? Close this dialog and tap any live card instead. The card opens the
          full bill preview.
        </p>
      </Modal>
    </PageTransition>
  );
}
