import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  BadgePercent,
  CheckCircle2,
  Clock3,
  LogOut,
  ReceiptText,
  RefreshCw,
  Smartphone,
  Timer,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { ConfirmDialog } from "../components/Dialog";
import { Field, Input, Select } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { ErrorState, LoadingState } from "../components/States";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import {
  dateTime,
  initials,
  minutesDuration,
  money,
  timeOf,
} from "../lib/format";
import type { DiscountType, PaymentMethod } from "../lib/types";
import { cn } from "../lib/utils";

export function CheckoutPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const id = Number(visitId ?? 0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountInput, setDiscountInput] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const visitQuery = useQuery({
    queryKey: ["visit", id],
    queryFn: () => api.getVisit(id),
    enabled: id > 0,
  });

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: 60_000,
  });

  const discountValue = useMemo(() => {
    const parsed = Number(discountInput);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }, [discountInput]);

  const quoteQuery = useQuery({
    queryKey: ["quote", id, discountType, discountValue],
    queryFn: () => api.getQuote(id, discountType, discountValue),
    enabled: id > 0 && visitQuery.data?.status === "active",
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.checkout(id, {
        payment_method: payment,
        discount_type: discountType,
        discount_value: discountValue,
      }),
    onSuccess: (bill) => {
      success(
        "Payment recorded",
        `${bill.child_name} · ${money(bill.amount)} paid by ${bill.payment_method.toUpperCase()}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["live"] });
      void queryClient.invalidateQueries({ queryKey: ["children"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
      void queryClient.removeQueries({ queryKey: ["visit", id] });
      void queryClient.removeQueries({ queryKey: ["quote", id] });
      navigate(`/bills/${bill.id}?new=1`, { replace: true });
    },
    onError: (err: Error) => {
      toastError("Checkout failed", err.message);
    },
  });

  useEffect(() => {
    if (visitQuery.data && visitQuery.data.status !== "active") {
      if (visitQuery.data.bill_id) {
        navigate(`/bills/${visitQuery.data.bill_id}`, { replace: true });
      }
    }
  }, [visitQuery.data, navigate]);

  if (id <= 0) {
    return (
      <PageTransition>
        <ErrorState
          title="Visit not found"
          message="The checkout link is invalid."
          onRetry={() => navigate("/live")}
        />
      </PageTransition>
    );
  }

  if (visitQuery.isLoading) {
    return (
      <PageTransition>
        <LoadingState label="Loading this visit…" className="min-h-[420px]" />
      </PageTransition>
    );
  }

  if (visitQuery.isError || !visitQuery.data) {
    return (
      <PageTransition>
        <ErrorState
          title="Could not open checkout"
          message={(visitQuery.error as Error)?.message}
          onRetry={() => void visitQuery.refetch()}
        />
      </PageTransition>
    );
  }

  const visit = visitQuery.data;
  const quote = quoteQuery.data;
  const settings = settingsQuery.data;

  const discountError =
    discountType === "percent" && discountValue > 100
      ? "Percentage cannot exceed 100%."
      : discountType !== "none" && discountInput !== "" && discountValue < 0
        ? "Enter a valid discount amount."
        : null;

  const canConfirm = Boolean(quote) && !discountError && !mutation.isPending;

  const discountLabel =
    discountType === "none"
      ? "No discount"
      : discountType === "flat"
        ? "Flat amount"
        : "Percentage";

  return (
    <PageTransition className="space-y-6">
      <button
        type="button"
        onClick={() => navigate("/live")}
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg text-[12px] font-semibold text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to live floor
      </button>

      <PageHeader
        eyebrow="Checkout"
        title={visit.child_name}
        description="Review the visit, apply an optional discount, then collect payment. The backend recalculates every amount at the moment you confirm."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="primary" dot>
              {visit.plan_name}
            </Badge>
            <Badge tone="neutral">{visit.booked_minutes} min booked</Badge>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* Left: visit detail */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="relative overflow-hidden bg-gradient-to-br from-tint via-white to-white p-5 sm:p-6">
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10" />
              <div className="relative flex items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-bold text-white shadow-[0_12px_24px_-12px_rgba(28,147,160,0.9)]">
                  {initials(visit.child_name)}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                    Checked in
                  </p>
                  <h2 className="mt-0.5 truncate text-xl font-extrabold tracking-[-0.02em] text-ink">
                    {visit.child_name}
                  </h2>
                  <p className="text-[12px] text-ink-muted">
                    Age {visit.child_age} · {visit.parent_name}
                  </p>
                  <p className="tabular text-[11px] text-ink-faint">+91 {visit.phone}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-ink/[0.06]">
              {[
                { label: "Check-in", value: timeOf(visit.check_in_at), icon: Clock3 },
                { label: "Planned end", value: timeOf(visit.planned_end_at), icon: Timer },
              ].map((item) => (
                <div key={item.label} className="bg-white p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-faint">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </p>
                  <p className="tabular mt-1.5 text-[15px] font-bold text-ink">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-ink/[0.06] p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <SummaryStat
                  label="Played so far"
                  value={minutesDuration(quote?.elapsed_minutes ?? 0)}
                />
                <SummaryStat
                  label="Booked"
                  value={minutesDuration(visit.booked_minutes)}
                />
                <SummaryStat
                  label="Overtime"
                  value={
                    quote && quote.overtime_minutes > 0
                      ? `${quote.overtime_minutes} min`
                      : "None"
                  }
                  tone={quote && quote.overtime_minutes > 0 ? "danger" : "success"}
                />
              </div>

              {settings ? (
                <p className="mt-4 rounded-xl bg-ink/[0.03] px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-muted">
                  {settings.grace_minutes} min grace ·{" "}
                  {money(settings.overtime_rate)} per started{" "}
                  {settings.overtime_block_minutes} min after grace. Closing time{" "}
                  {settings.closing_time}.
                </p>
              ) : null}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <CardHeader
              title="Discount"
              description="Optional. Flat discounts are capped at the subtotal, percentages at 100%."
              icon={<BadgePercent className="h-5 w-5" />}
              action={
                <Badge tone={discountType === "none" ? "neutral" : "primary"}>
                  {discountLabel}
                </Badge>
              }
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Discount type" htmlFor="discount-type">
                <Select
                  id="discount-type"
                  value={discountType}
                  onChange={(event) => {
                    const next = event.target.value as DiscountType;
                    setDiscountType(next);
                    if (next === "none") setDiscountInput("");
                  }}
                >
                  <option value="none">No discount</option>
                  <option value="flat">Flat amount (₹)</option>
                  <option value="percent">Percentage (%)</option>
                </Select>
              </Field>

              <Field
                label={discountType === "percent" ? "Percentage" : "Amount (₹)"}
                htmlFor="discount-value"
                error={discountError}
                hint={
                  discountType === "percent"
                    ? "0 – 100"
                    : discountType === "flat"
                      ? "Capped at the subtotal"
                      : "Choose a discount type to enable this field"
                }
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-faint">
                    {discountType === "percent" ? "%" : "₹"}
                  </span>
                  <Input
                    id="discount-value"
                    type="number"
                    min={0}
                    max={discountType === "percent" ? 100 : undefined}
                    step={discountType === "percent" ? 1 : 1}
                    value={discountInput}
                    disabled={discountType === "none"}
                    onChange={(event) => setDiscountInput(event.target.value)}
                    placeholder="0"
                    className="pl-10"
                    invalid={Boolean(discountError)}
                  />
                </div>
              </Field>
            </div>

            {quote && quote.discount_amount > 0 ? (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-success/20 bg-success-soft/60 px-4 py-3">
                <span className="flex items-center gap-2 text-[12px] font-semibold text-success-dark">
                  <CheckCircle2 className="h-4 w-4" />
                  Discount applied
                </span>
                <span className="tabular text-[14px] font-bold text-success-dark">
                  − {money(quote.discount_amount)}
                </span>
              </div>
            ) : null}
          </Card>
        </div>

        {/* Right: payment summary */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="border-b border-ink/[0.06] bg-[#FAFCFC] px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint text-primary">
                    <ReceiptText className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold text-ink">Bill preview</p>
                    <p className="text-[11px] text-ink-faint">Live from the server</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void quoteQuery.refetch()}
                  loading={quoteQuery.isFetching && !quoteQuery.isLoading}
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </div>
            </div>

            {quoteQuery.isLoading ? (
              <LoadingState label="Calculating bill…" className="m-5 min-h-[220px]" />
            ) : quoteQuery.isError || !quote ? (
              <div className="p-5">
                <ErrorState
                  title="Could not calculate the bill"
                  message={(quoteQuery.error as Error)?.message}
                  onRetry={() => void quoteQuery.refetch()}
                />
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <div className="space-y-2.5">
                  <Line
                    label={`${visit.plan_name} · ${visit.booked_minutes} min`}
                    value={money(quote.plan_price)}
                  />
                  <Line
                    label={
                      quote.overtime_minutes > 0
                        ? `Overtime · ${quote.overtime_minutes} min (${quote.overtime_blocks} × ${money(quote.overtime_rate)})`
                        : "Overtime"
                    }
                    value={
                      quote.overtime_minutes > 0 ? money(quote.overtime_amount) : "Free"
                    }
                    muted={quote.overtime_minutes === 0}
                  />
                  <div className="h-px bg-ink/[0.07]" />
                  <Line label="Subtotal" value={money(quote.subtotal)} strong />
                  {quote.discount_amount > 0 ? (
                    <Line
                      label={`Discount${
                        quote.discount_type === "percent"
                          ? ` (${quote.discount_value}%)`
                          : ""
                      }`}
                      value={`− ${money(quote.discount_amount)}`}
                      tone="success"
                    />
                  ) : null}
                </div>

                <div className="mt-4 flex items-end justify-between rounded-2xl bg-ink px-4 py-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      Total payable
                    </p>
                    <p className="tabular mt-1 text-[32px] font-extrabold leading-none tracking-[-0.04em] text-white">
                      {money(quote.total)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70">
                    incl. all taxes
                  </span>
                </div>

                {quote.overtime_minutes > 0 ? (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber/50 bg-amber-soft/70 px-3.5 py-2.5">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-dark" />
                    <p className="text-[11.5px] leading-relaxed text-amber-dark">
                      This visit has run {quote.overtime_minutes} min past the grace
                      period, so {quote.overtime_blocks} overtime block
                      {quote.overtime_blocks === 1 ? "" : "s"} were added.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <CardHeader
              title="Payment method"
              description="Choose how the parent is paying today."
              icon={<Banknote className="h-5 w-5" />}
            />
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {(
                [
                  { key: "cash", label: "Cash", icon: Banknote },
                  { key: "upi", label: "UPI", icon: Smartphone },
                ] as const
              ).map((option) => {
                const selected = payment === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPayment(option.key)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3.5 text-left transition",
                      selected
                        ? "border-primary bg-tint shadow-[0_0_0_3px_rgba(28,147,160,0.1)]"
                        : "border-ink/10 bg-white hover:border-primary/30 hover:bg-tint/30",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-lg",
                        selected ? "bg-primary text-white" : "bg-ink/[0.05] text-ink-muted",
                      )}
                    >
                      <option.icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-[13px] font-bold text-ink">
                        {option.label}
                      </span>
                      <span className="block text-[10px] text-ink-faint">
                        {option.key === "cash" ? "Counter cash" : "Scan & pay"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <Button
              size="xl"
              fullWidth
              className="mt-4"
              variant="success"
              disabled={!canConfirm}
              loading={mutation.isPending}
              onClick={() => setConfirmOpen(true)}
              leftIcon={<LogOut className="h-5 w-5" />}
              rightIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Collect {quote ? money(quote.total) : "payment"} & check out
            </Button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-faint">
              The final amount is recalculated on the server to the exact second when
              you confirm. A printable 80 mm bill is created.
            </p>
          </Card>

          <div className="rounded-2xl border border-ink/[0.06] bg-white/70 px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
            <span className="font-semibold text-ink">Need to extend instead?</span>{" "}
            Close this and re-check the child in after checkout — the plan price is
            snapshotted per visit, so earlier bills never change.
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await mutation.mutateAsync();
        }}
        title="Confirm checkout"
        description="This closes the visit, creates a bill and cannot be undone."
        confirmLabel={`Collect ${quote ? money(quote.total) : ""}`}
        tone="success"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-ink/[0.08] bg-[#FAFCFC] p-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-tint text-[12px] font-bold text-primary-700">
              {initials(visit.child_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-ink">{visit.child_name}</p>
              <p className="truncate text-[11px] text-ink-muted">
                {visit.plan_name} · in at {timeOf(visit.check_in_at)}
              </p>
            </div>
          </div>

          <dl className="space-y-2 rounded-xl border border-ink/[0.08] p-3.5">
            <div className="flex items-center justify-between text-[12px]">
              <dt className="text-ink-muted">Payment</dt>
              <dd className="font-semibold capitalize text-ink">{payment}</dd>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <dt className="text-ink-muted">Discount</dt>
              <dd className="font-semibold text-ink">
                {quote && quote.discount_amount > 0
                  ? `− ${money(quote.discount_amount)}`
                  : "None"}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-ink/15 pt-2">
              <dt className="text-[12px] font-semibold text-ink">Total</dt>
              <dd className="tabular text-[16px] font-extrabold text-ink">
                {quote ? money(quote.total) : "—"}
              </dd>
            </div>
          </dl>

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
            <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Collected by you and recorded against {dateTime(new Date().toISOString())} IST.
          </p>
        </div>
      </ConfirmDialog>

      <p className="text-center text-[11px] text-ink-faint">
        Looking for a bill? <Link to="/reports" className="font-semibold text-primary hover:text-primary-700">Open today&apos;s report</Link>.
      </p>
    </PageTransition>
  );
}

function SummaryStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <div className="rounded-xl border border-ink/[0.06] bg-[#FAFCFC] p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1 text-[15px] font-bold",
          tone === "danger"
            ? "text-danger"
            : tone === "success"
              ? "text-success-dark"
              : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Line({
  label,
  value,
  strong = false,
  muted = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  tone?: "success";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={cn(
          "text-[12.5px]",
          strong ? "font-semibold text-ink" : muted ? "text-ink-faint" : "text-ink-muted",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular text-[13px]",
          strong ? "font-bold text-ink" : "font-medium",
          tone === "success" ? "text-success-dark" : "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}
