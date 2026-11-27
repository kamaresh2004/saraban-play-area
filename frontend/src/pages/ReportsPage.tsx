import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileBarChart,
  RefreshCw,
  ReceiptText,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useToast } from "../context/ToastContext";
import { api, downloadDailyCsv } from "../lib/api";
import {
  dateLabelFromIsoDate,
  initials,
  minutesDuration,
  money,
  timeOf,
  todayIst,
} from "../lib/format";
import { cn } from "../lib/utils";

function shiftDate(value: string, days: number): string {
  const base = new Date(`${value}T12:00:00+05:30`);
  base.setUTCDate(base.getUTCDate() + days);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const find = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${find("year")}-${find("month")}-${find("day")}`;
}

export function ReportsPage() {
  const today = todayIst();
  const [date, setDate] = useState(today);
  const [exporting, setExporting] = useState(false);
  const { success, error: toastError } = useToast();

  const reportQuery = useQuery({
    queryKey: ["reports", "daily", date],
    queryFn: () => api.getDailyReport(date),
    placeholderData: (previous) => previous,
  });

  const report = reportQuery.data;
  const isToday = date === today;

  const stats = useMemo(() => {
    if (!report) return null;
    return {
      visits: report.visits_count,
      completed: report.completed_visits,
      active: report.active_visits,
      playtime: report.total_playtime_minutes,
      bills: report.bills_count,
      collection: report.collection,
    };
  }, [report]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadDailyCsv(date);
      success("CSV downloaded", `Report for ${dateLabelFromIsoDate(date)} is ready.`);
    } catch (err) {
      toastError("Export failed", (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Money & visits"
        title="Daily reports"
        description="Collection, footfall and every bill for a day, in Asia/Kolkata time. Export a spreadsheet copy for accounts."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void reportQuery.refetch()}
              loading={reportQuery.isFetching && !reportQuery.isLoading}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
            <Button
              onClick={() => void handleExport()}
              loading={exporting}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export CSV
            </Button>
          </>
        }
      />

      {/* Date controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-ink/[0.06] bg-white p-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Previous day"
            onClick={() => setDate((current) => shiftDate(current, -1))}
            className="h-10 w-10 px-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="date"
              value={date}
              max={today}
              onChange={(event) => {
                if (event.target.value) setDate(event.target.value);
              }}
              className="input h-10 w-[172px] pl-10 text-[13px]"
              aria-label="Report date"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Next day"
            onClick={() => setDate((current) => shiftDate(current, 1))}
            disabled={date >= today}
            className="h-10 w-10 px-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday ? (
            <Button variant="ghost" size="sm" onClick={() => setDate(today)} className="h-10">
              Today
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 px-1.5">
          <Badge tone={isToday ? "success" : "neutral"} dot>
            {isToday ? "Live day" : "Past day"}
          </Badge>
          <p className="text-[13px] font-semibold text-ink">
            {dateLabelFromIsoDate(date)}
          </p>
        </div>
      </div>

      {reportQuery.isLoading ? (
        <LoadingState label="Building the report…" className="min-h-[360px]" />
      ) : reportQuery.isError || !stats ? (
        <ErrorState
          title="Could not load the report"
          message={(reportQuery.error as Error)?.message}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ReportStat
              label="Collection"
              value={money(stats.collection.total)}
              hint={`Cash ${money(stats.collection.cash)} · UPI ${money(stats.collection.upi)}`}
              icon={Wallet}
              tone="primary"
            />
            <ReportStat
              label="Bills paid"
              value={String(stats.bills)}
              hint="Paid visits on this day"
              icon={ReceiptText}
              tone="success"
            />
            <ReportStat
              label="Visits"
              value={String(stats.visits)}
              hint={`${stats.completed} completed · ${stats.active} still inside`}
              icon={Users}
              tone="amber"
            />
            <ReportStat
              label="Playtime"
              value={minutesDuration(stats.playtime)}
              hint="Total across all visits"
              icon={Clock3}
              tone="ink"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SplitCard
              label="Cash"
              value={stats.collection.cash}
              total={stats.collection.total}
              barClassName="bg-primary"
            />
            <SplitCard
              label="UPI"
              value={stats.collection.upi}
              total={stats.collection.total}
              barClassName="bg-amber"
            />
            <div className="card flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-tint text-primary">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  Average bill
                </p>
                <p className="tabular text-lg font-extrabold text-ink">
                  {money(stats.bills ? stats.collection.total / stats.bills : 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Bills list */}
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-ink/[0.06] bg-[#FAFCFC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-primary shadow-sm">
                  <FileBarChart className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-[14px] font-bold text-ink">Bills & receipts</p>
                  <p className="text-[11px] text-ink-faint">
                    {stats.bills === 0
                      ? "No payments recorded for this day"
                      : `${stats.bills} bill${stats.bills === 1 ? "" : "s"} · sorted by payment time`}
                  </p>
                </div>
              </div>
              <Badge tone="neutral">{dateLabelFromIsoDate(date)}</Badge>
            </div>

            {report && report.bills.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No bills on this day"
                message={
                  isToday
                    ? "Bills appear here the moment a checkout is completed. Try checking a child out from the live floor."
                    : "Pick another date, or check whether the play area was closed."
                }
                className="m-5 border-0 bg-transparent"
                action={
                  isToday ? (
                    <Link
                      to="/live"
                      className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-white"
                    >
                      Open live floor
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setDate(today)}>
                      Jump to today
                    </Button>
                  )
                }
              />
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[820px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-ink/[0.06] text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                        <th className="px-5 py-2.5 font-semibold">Bill</th>
                        <th className="px-3 py-2.5 font-semibold">Child</th>
                        <th className="px-3 py-2.5 font-semibold">Plan</th>
                        <th className="px-3 py-2.5 font-semibold">In – out</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Play</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Overtime</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                        <th className="px-3 py-2.5 font-semibold">Paid</th>
                        <th className="px-5 py-2.5 text-right font-semibold">Open</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/[0.05]">
                      {report?.bills.map((bill) => (
                        <tr key={bill.id} className="group transition hover:bg-tint/30">
                          <td className="whitespace-nowrap px-5 py-3">
                            <Link
                              to={`/bills/${bill.id}`}
                              className="tabular text-[12px] font-semibold text-primary-700 hover:underline"
                            >
                              {bill.bill_number}
                            </Link>
                            <p className="text-[10px] text-ink-faint">{timeOf(bill.paid_at)}</p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-tint text-[10px] font-bold text-primary-700">
                                {initials(bill.child_name)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[12.5px] font-semibold text-ink">
                                  {bill.child_name}
                                </p>
                                <p className="truncate text-[10px] text-ink-faint">
                                  {bill.parent_name}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-[12px] text-ink-muted">
                            {bill.plan_name}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-[11.5px] text-ink-muted">
                            {timeOf(bill.check_in_at)} – {timeOf(bill.check_out_at)}
                          </td>
                          <td className="tabular whitespace-nowrap px-3 py-3 text-right text-[12px] text-ink-muted">
                            {bill.play_minutes} min
                          </td>
                          <td className="tabular whitespace-nowrap px-3 py-3 text-right text-[12px]">
                            {bill.overtime_amount > 0 ? (
                              <span className="font-semibold text-amber-dark">
                                {money(bill.overtime_amount)}
                              </span>
                            ) : (
                              <span className="text-ink-faint">—</span>
                            )}
                          </td>
                          <td className="tabular whitespace-nowrap px-3 py-3 text-right text-[13px] font-bold text-ink">
                            {money(bill.amount)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <Badge tone={bill.payment_method === "cash" ? "primary" : "warning"}>
                              {bill.payment_method.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right">
                            <Link
                              to={`/bills/${bill.id}`}
                              className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary-700 hover:bg-tint"
                            >
                              View
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-ink/10 bg-[#FAFCFC]">
                        <td colSpan={6} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                          Day total
                        </td>
                        <td className="tabular px-3 py-3 text-right text-[14px] font-extrabold text-ink">
                          {money(stats.collection.total)}
                        </td>
                        <td colSpan={2} className="px-5 py-3 text-right text-[10px] text-ink-faint">
                          Cash {money(stats.collection.cash)} · UPI{" "}
                          {money(stats.collection.upi)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile cards */}
                <ul className="divide-y divide-ink/[0.05] lg:hidden">
                  {report?.bills.map((bill) => (
                    <li key={bill.id}>
                      <Link
                        to={`/bills/${bill.id}`}
                        className="block px-4 py-3.5 transition hover:bg-tint/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tint text-[11px] font-bold text-primary-700">
                              {initials(bill.child_name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-bold text-ink">
                                {bill.child_name}
                              </p>
                              <p className="tabular truncate text-[10.5px] text-ink-faint">
                                {bill.bill_number}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="tabular text-[14px] font-extrabold text-ink">
                              {money(bill.amount)}
                            </p>
                            <Badge
                              tone={bill.payment_method === "cash" ? "primary" : "warning"}
                              className="mt-0.5"
                            >
                              {bill.payment_method.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted">
                          <span>
                            {bill.plan_name} · {bill.play_minutes} min
                          </span>
                          <span>{timeOf(bill.paid_at)}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                  <li className="flex items-center justify-between bg-[#FAFCFC] px-4 py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                      Day total
                    </span>
                    <span className="tabular text-[15px] font-extrabold text-ink">
                      {money(stats.collection.total)}
                    </span>
                  </li>
                </ul>
              </>
            )}
          </Card>

          <p className="text-center text-[11px] text-ink-faint">
            Reports use the Asia/Kolkata calendar day. Payments recorded after midnight
            appear on the next day&apos;s report.
          </p>
        </>
      )}
    </PageTransition>
  );
}

function ReportStat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
  tone: "primary" | "success" | "amber" | "ink";
}) {
  const tones = {
    primary: "bg-tint text-primary",
    success: "bg-success-soft text-success",
    amber: "bg-amber-soft text-amber-dark",
    ink: "bg-ink/[0.05] text-ink",
  } as const;

  return (
    <div className="card flex items-start gap-3.5 p-4">
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tones[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {label}
        </p>
        <p className="tabular mt-0.5 text-[22px] font-extrabold leading-none tracking-[-0.02em] text-ink">
          {value}
        </p>
        <p className="mt-1 truncate text-[10.5px] text-ink-faint">{hint}</p>
      </div>
    </div>
  );
}

function SplitCard({
  label,
  value,
  total,
  barClassName,
}: {
  label: string;
  value: number;
  total: number;
  barClassName: string;
}) {
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {label}
        </p>
        <span className="tabular text-[10px] font-semibold text-ink-faint">{share}%</span>
      </div>
      <p className="tabular mt-1 text-[20px] font-extrabold leading-none text-ink">
        {money(value)}
      </p>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", barClassName)}
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}
