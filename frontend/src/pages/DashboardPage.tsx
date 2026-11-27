import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  ArrowRight,
  BadgeIndianRupee,
  Banknote,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  FastForward,
  LayoutDashboard,
  ReceiptText,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Timer,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { Input } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { ErrorState, LoadingState } from "../components/States";
import { StatCard } from "../components/StatCard";
import { useToast } from "../context/ToastContext";
import { WeekChart } from "../features/dashboard/WeekChart";
import { useLive } from "../hooks/useLive";
import { api } from "../lib/api";
import {
  initials,
  minutesDuration,
  money,
  timeOf,
  todayIst,
  weekdayDate,
} from "../lib/format";
import type { Plan } from "../lib/types";
import { cn } from "../lib/utils";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const live = useLive(20000);
  const [planDrafts, setPlanDrafts] = useState<Record<number, string>>({});

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
    refetchInterval: 30_000,
  });

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (dashboardQuery.data) {
      setPlanDrafts((current) => {
        const next: Record<number, string> = {};
        for (const plan of dashboardQuery.data.plans) {
          next[plan.id] = current[plan.id] ?? String(plan.price);
        }
        return next;
      });
    }
  }, [dashboardQuery.data]);

  const planMutation = useMutation({
    mutationFn: ({ id, price }: { id: number; price: number }) =>
      api.updatePlan(id, { price }),
    onSuccess: (plan) => {
      success("Price updated", `${plan.name} is now ${money(plan.price)}.`);
      setPlanDrafts((current) => ({ ...current, [plan.id]: String(plan.price) }));
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (err: Error) => toastError("Could not update price", err.message),
  });

  const clockMutation = useMutation({
    mutationFn: (minutes: number) =>
      minutes === 0 ? api.resetClock() : api.fastForward(minutes),
    onSuccess: (clock, minutes) => {
      if (minutes === 0) {
        success("Demo clock reset", "Live timers are back to real time.");
      } else {
        success(
          `Clock moved ${minutes > 0 ? "forward" : "back"} ${Math.abs(minutes)} min`,
          "Live timers and billing now use the shifted demo time.",
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["live"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      void queryClient.invalidateQueries({ queryKey: ["quote"] });
      return clock;
    },
    onError: (err: Error) => toastError("Clock control failed", err.message),
  });

  const data = dashboardQuery.data;
  const offset = settingsQuery.data?.clock_offset_minutes ?? 0;

  const plans = useMemo(() => data?.plans ?? [], [data]);

  const savePlan = (plan: Plan) => {
    const raw = planDrafts[plan.id] ?? String(plan.price);
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) {
      toastError("Invalid price", "Enter a price of zero or more.");
      return;
    }
    if (price === plan.price) return;
    planMutation.mutate({ id: plan.id, price });
  };

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Owner view"
        title="Dashboard"
        description="Today at a glance: who is playing, what came in, and how the week is trending. Timers and totals stay in sync with the front desk."
        actions={
          <>
            <Badge tone={offset ? "warning" : "success"} dot>
              {offset ? `Demo clock ${offset > 0 ? "+" : ""}${offset} min` : "Real time"}
            </Badge>
            <Link
              to="/reports"
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/20 hover:bg-ink/[0.02]"
            >
              <ReceiptText className="h-4 w-4" />
              Today&apos;s report
            </Link>
          </>
        }
      />

      {dashboardQuery.isLoading ? (
        <LoadingState label="Loading the dashboard…" className="min-h-[420px]" />
      ) : dashboardQuery.isError || !data ? (
        <ErrorState
          title="Dashboard unavailable"
          message={(dashboardQuery.error as Error)?.message}
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Inside now"
              value={live.data?.visits.length ?? data.inside_now}
              hint={
                data.warning_count + data.overdue_count > 0
                  ? `${data.warning_count} ending soon · ${data.overdue_count} overdue`
                  : "Nobody needs attention"
              }
              icon={Users}
              tone={data.overdue_count > 0 ? "danger" : "primary"}
            />
            <StatCard
              label="Today's collection"
              value={money(data.today_collection)}
              hint={`Cash ${money(data.today_cash)} · UPI ${money(data.today_upi)}`}
              icon={Wallet}
              tone="success"
            />
            <StatCard
              label="Visits today"
              value={data.today_visits}
              hint={`${data.recent_bills.length ? "Recent bills below" : "No bills yet"}`}
              icon={CalendarClock}
              tone="amber"
            />
            <StatCard
              label="Average play"
              value={minutesDuration(data.average_play_minutes)}
              hint="Completed visits today"
              icon={Timer}
              tone="ink"
            />
          </div>

          {/* Alerts strip */}
          {data.warning_count + data.overdue_count > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber/50 bg-amber-soft/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-dark shadow-sm">
                  <AlarmClock className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[13px] font-bold text-ink">
                    {data.overdue_count > 0
                      ? `${data.overdue_count} visit${data.overdue_count === 1 ? "" : "s"} overdue`
                      : "Some timers are ending soon"}
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-amber-dark/80">
                    {data.warning_count} ending soon · {data.overdue_count} past the booked
                    time. Check the live floor to settle them.
                  </p>
                </div>
              </div>
              <Link
                to="/live"
                className="focus-ring inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[12px] font-semibold text-white"
              >
                Open live floor
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
            {/* Week chart */}
            <Card className="p-5">
              <CardHeader
                title="Last 7 days"
                description="Visits as bars, collection as the amber line."
                icon={<LayoutDashboard className="h-5 w-5" />}
                action={
                  <div className="flex items-center gap-3 text-[10px] font-semibold text-ink-faint">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      Visits
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-0.5 w-3.5 rounded-full bg-amber" />
                      Collection
                    </span>
                  </div>
                }
              />
              <div className="mt-4">
                <WeekChart data={data.week} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-ink/[0.06] pt-4">
                {data.week.slice(-3).map((point) => (
                  <div key={point.date} className="rounded-xl bg-[#FAFCFC] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                      {weekdayDate(point.date)}
                    </p>
                    <p className="tabular mt-0.5 text-[13px] font-bold text-ink">
                      {point.visits} visits
                    </p>
                    <p className="tabular text-[11px] text-primary-700">
                      {money(point.collection)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Demo clock */}
            <Card className="p-5">
              <CardHeader
                title="Demo clock"
                description="Move time forward to show overtime, alerts and billing without waiting."
                icon={<FastForward className="h-5 w-5" />}
              />
              <div className="mt-4 rounded-2xl bg-ink px-4 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Offset from real time
                </p>
                <p className="tabular mt-1 text-[26px] font-extrabold leading-none text-white">
                  {offset > 0 ? "+" : ""}
                  {offset} min
                </p>
                <p className="mt-1.5 text-[11px] text-white/45">
                  Server time {live.data ? timeOf(live.data.server_now) : "—"} IST
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="amber"
                  onClick={() => clockMutation.mutate(15)}
                  loading={clockMutation.isPending && clockMutation.variables === 15}
                  leftIcon={<FastForward className="h-4 w-4" />}
                >
                  +15 min
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => clockMutation.mutate(-15)}
                  loading={clockMutation.isPending && clockMutation.variables === -15}
                  leftIcon={<RotateCcw className="h-4 w-4" />}
                >
                  −15 min
                </Button>
              </div>
              <Button
                variant="ghost"
                fullWidth
                className="mt-2"
                onClick={() => clockMutation.mutate(0)}
                loading={clockMutation.isPending && clockMutation.variables === 0}
                leftIcon={<Sparkles className="h-4 w-4" />}
              >
                Reset to real time
              </Button>

              <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-faint">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Demo only. Offsetting the clock changes live timers, quotes and new bills
                immediately.
              </p>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            {/* Recent bills */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink/[0.06] bg-[#FAFCFC] px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-primary shadow-sm">
                    <ReceiptText className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold text-ink">Recent payments</p>
                    <p className="text-[11px] text-ink-faint">Newest first</p>
                  </div>
                </div>
                <Link
                  to="/reports"
                  className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary-700 hover:bg-tint"
                >
                  All bills
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {data.recent_bills.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-[13px] font-semibold text-ink">No payments yet</p>
                  <p className="mt-1 text-[11.5px] text-ink-muted">
                    Completed checkouts will appear here instantly.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-ink/[0.05]">
                  {data.recent_bills.map((bill) => (
                    <li key={bill.id}>
                      <Link
                        to={`/bills/${bill.id}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-tint/30 sm:px-5"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tint text-[11px] font-bold text-primary-700">
                          {initials(bill.child_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink">
                            {bill.child_name}
                          </p>
                          <p className="truncate text-[10.5px] text-ink-faint">
                            {bill.plan_name} · {timeOf(bill.paid_at)} ·{" "}
                            {bill.payment_method.toUpperCase()}
                          </p>
                        </div>
                        <span className="tabular shrink-0 text-[13px] font-bold text-ink">
                          {money(bill.amount)}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Plan prices */}
            <Card className="p-5">
              <CardHeader
                title="Plan prices"
                description="Changes apply to new check-ins. Existing visits keep their saved price."
                icon={<BadgeIndianRupee className="h-5 w-5" />}
              />
              <div className="mt-4 space-y-3">
                {plans.map((plan) => {
                  const draft = planDrafts[plan.id] ?? String(plan.price);
                  const dirty = Number(draft) !== plan.price;
                  return (
                    <div
                      key={plan.id}
                      className="rounded-xl border border-ink/[0.08] bg-[#FAFCFC] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-semibold text-ink">
                            {plan.name}
                          </p>
                          <p className="text-[10px] text-ink-faint">
                            {plan.duration_minutes === null
                              ? "Until closing time"
                              : `${plan.duration_minutes} minutes`}{" "}
                            · {plan.code}
                          </p>
                        </div>
                        <Badge tone={plan.is_active ? "success" : "neutral"} dot>
                          {plan.is_active ? "Active" : "Off"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <div className="relative flex-1">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-ink-faint">
                            ₹
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            value={draft}
                            onChange={(event) =>
                              setPlanDrafts((current) => ({
                                ...current,
                                [plan.id]: event.target.value,
                              }))
                            }
                            className="h-10 pl-8 text-[13px]"
                            aria-label={`${plan.name} price`}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant={dirty ? "primary" : "secondary"}
                          disabled={!dirty}
                          loading={
                            planMutation.isPending && planMutation.variables?.id === plan.id
                          }
                          onClick={() => savePlan(plan)}
                          leftIcon={<Save className="h-3.5 w-3.5" />}
                          className="h-10 shrink-0"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link
                to="/settings"
                className="focus-ring mt-4 flex items-center justify-between rounded-xl border border-ink/[0.08] px-3.5 py-2.5 text-[12px] font-semibold text-ink-muted transition hover:border-primary/30 hover:text-ink"
              >
                Billing & business settings
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Card>
          </div>

          {/* Payment split */}
          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-success-soft text-success">
                  <CircleDollarSign className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[13px] font-bold text-ink">Today&apos;s split</p>
                  <p className="text-[11px] text-ink-faint">
                    {weekdayDate(todayIst())} · {data.recent_bills.length ? "payments recorded" : "no payments yet"}
                  </p>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2 sm:max-w-md">
                {[
                  {
                    label: "Cash",
                    value: data.today_cash,
                    icon: Banknote,
                    tone: "bg-tint text-primary",
                  },
                  {
                    label: "UPI",
                    value: data.today_upi,
                    icon: Smartphone,
                    tone: "bg-amber-soft text-amber-dark",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2.5 rounded-xl border border-ink/[0.06] px-3 py-2.5"
                  >
                    <span className={cn("grid h-8 w-8 place-items-center rounded-lg", item.tone)}>
                      <item.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                        {item.label}
                      </p>
                      <p className="tabular text-[14px] font-bold text-ink">
                        {money(item.value)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}
    </PageTransition>
  );
}
