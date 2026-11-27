import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Printer,
  ReceiptText,
  Share2,
  Smartphone,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { ErrorState, LoadingState } from "../components/States";
import { useToast } from "../context/ToastContext";
import { BillReceipt } from "../features/billing/BillReceipt";
import { api } from "../lib/api";
import { money, timeOf } from "../lib/format";

export function BillPage() {
  const { billId } = useParams<{ billId: string }>();
  const id = Number(billId ?? 0);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, info } = useToast();
  const justPaid = searchParams.get("new") === "1";
  const announced = useRef(false);
  const [copied, setCopied] = useState(false);

  const billQuery = useQuery({
    queryKey: ["bill", id],
    queryFn: () => api.getBill(id),
    enabled: id > 0,
    staleTime: 60_000,
  });

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (justPaid && billQuery.data && !announced.current) {
      announced.current = true;
      success(
        "Bill ready to print",
        `${billQuery.data.bill_number} · ${money(billQuery.data.amount)}`,
      );
    }
  }, [justPaid, billQuery.data, success]);

  if (id <= 0) {
    return (
      <PageTransition>
        <ErrorState
          title="Bill not found"
          message="This bill link is invalid."
          onRetry={() => navigate("/reports")}
        />
      </PageTransition>
    );
  }

  if (billQuery.isLoading) {
    return (
      <PageTransition>
        <LoadingState label="Loading bill…" className="min-h-[420px]" />
      </PageTransition>
    );
  }

  if (billQuery.isError || !billQuery.data) {
    return (
      <PageTransition>
        <ErrorState
          title="Could not load this bill"
          message={(billQuery.error as Error)?.message}
          onRetry={() => void billQuery.refetch()}
        />
      </PageTransition>
    );
  }

  const bill = billQuery.data;

  const shareText = [
    `${settingsQuery.data?.business_name ?? "Saraban Play Area"}`,
    `Bill ${bill.bill_number}`,
    `${bill.child_name} · ${bill.plan_name}`,
    `Played ${bill.play_minutes} min`,
    `Total ${money(bill.amount)} (${bill.payment_method.toUpperCase()})`,
  ].join("\n");

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      info("Bill summary copied", "Paste it into WhatsApp or a message.");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      info("Copy not available", "Your browser blocked clipboard access.");
    }
  };

  return (
    <PageTransition className="space-y-6">
      <button
        type="button"
        onClick={() => navigate("/reports")}
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg text-[12px] font-semibold text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to reports
      </button>

      <PageHeader
        eyebrow={justPaid ? "Payment complete" : "Bill reprint"}
        title={justPaid ? "Receipt ready" : bill.bill_number}
        description={
          justPaid
            ? "The visit is closed. Print the 80 mm receipt for the parent, or open it again later from the daily report."
            : "A permanent, immutable snapshot of this visit. Reprinting never changes the amount."
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{bill.bill_number}</Badge>
            <Badge tone={justPaid ? "success" : "primary"} dot>
              {justPaid ? "Just paid" : "Completed"}
            </Badge>
          </div>
        }
      />

      {justPaid ? (
        <div className="flex items-start gap-3 rounded-2xl border border-success/20 bg-success-soft/60 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-success shadow-sm">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-success-dark">
              {money(bill.amount)} collected from {bill.parent_name}
            </p>
            <p className="text-[11.5px] leading-relaxed text-success-dark/70">
              {bill.child_name} checked out at {timeOf(bill.check_out_at)} ·{" "}
              {bill.payment_method === "cash" ? "Cash" : "UPI"} · billed by{" "}
              {bill.staff_name}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        {/* Receipt */}
        <div>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-ink/[0.06] bg-[#FAFCFC] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-tint text-primary">
                  <ReceiptText className="h-4 w-4" />
                </span>
                <p className="text-[12px] font-semibold text-ink">80 mm thermal receipt</p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                Preview
              </span>
            </div>
            <div className="bg-[#F4F8F9] p-3 sm:p-5">
              <div className="mx-auto w-full max-w-[330px] overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
                <BillReceipt bill={bill} settings={settingsQuery.data} />
              </div>
            </div>
          </Card>

          <div className="no-print mt-3 grid grid-cols-2 gap-2.5">
            <Button
              size="lg"
              onClick={() => window.print()}
              leftIcon={<Printer className="h-[18px] w-[18px]" />}
            >
              Print receipt
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => void copyShare()}
              leftIcon={<Share2 className="h-[18px] w-[18px]" />}
            >
              {copied ? "Copied" : "Copy summary"}
            </Button>
          </div>
          <p className="no-print mt-2 text-center text-[11px] leading-relaxed text-ink-faint">
            In the print dialog choose the 80 mm printer and disable headers/footers. Only
            the receipt is printed.
          </p>
        </div>

        {/* Detail */}
        <div className="space-y-4">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Bill summary
                </p>
                <h2 className="mt-0.5 text-xl font-extrabold tracking-[-0.02em] text-ink">
                  {bill.child_name}
                </h2>
                <p className="text-[12px] text-ink-muted">
                  {bill.parent_name} · +91 {bill.phone}
                </p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-tint text-primary">
                {bill.payment_method === "cash" ? (
                  <Banknote className="h-6 w-6" />
                ) : (
                  <Smartphone className="h-6 w-6" />
                )}
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink/[0.06] bg-ink/[0.06]">
              {[
                { label: "Plan", value: bill.plan_name },
                { label: "Played", value: `${bill.play_minutes} min` },
                { label: "Checked in", value: timeOf(bill.check_in_at) },
                { label: "Checked out", value: timeOf(bill.check_out_at) },
                { label: "Payment", value: bill.payment_method.toUpperCase() },
                { label: "Billed by", value: bill.staff_name },
              ].map((row) => (
                <div key={row.label} className="bg-white px-3.5 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 truncate text-[13px] font-semibold text-ink">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between bg-ink px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Amount paid
                </p>
                <p className="tabular mt-1 text-[28px] font-extrabold leading-none tracking-[-0.04em] text-white">
                  {money(bill.amount)}
                </p>
              </div>
              <span className="rounded-full bg-success/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                Paid
              </span>
            </div>

            <div className="space-y-2.5 p-5">
              <DetailRow label="Plan price" value={money(bill.plan_price)} />
              <DetailRow
                label={
                  bill.overtime_minutes > 0
                    ? `Overtime · ${bill.overtime_minutes} min`
                    : "Overtime"
                }
                value={
                  bill.overtime_minutes > 0 ? money(bill.overtime_amount) : "Free"
                }
                muted={bill.overtime_minutes === 0}
              />
              <div className="h-px bg-ink/[0.07]" />
              <DetailRow label="Subtotal" value={money(bill.subtotal)} strong />
              {bill.discount_amount > 0 ? (
                <DetailRow
                  label={
                    bill.discount_type === "percent"
                      ? `Discount (${bill.discount_value}%)`
                      : "Discount"
                  }
                  value={`− ${money(bill.discount_amount)}`}
                  tone="success"
                />
              ) : null}
              <div className="h-px bg-ink/[0.07]" />
              <DetailRow label="Total" value={money(bill.amount)} strong />
            </div>
          </Card>

          <div className="no-print flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" fullWidth onClick={() => navigate("/live")}>
              Back to live floor
            </Button>
            <Link
              to="/reports"
              className="focus-ring inline-flex h-11 w-full items-center justify-center rounded-xl border border-ink/10 bg-white text-sm font-semibold text-ink shadow-sm transition hover:border-ink/20 hover:bg-ink/[0.02]"
            >
              Today&apos;s report
            </Link>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function DetailRow({
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
        className={
          strong
            ? "text-[13px] font-semibold text-ink"
            : muted
              ? "text-[12.5px] text-ink-faint"
              : "text-[12.5px] text-ink-muted"
        }
      >
        {label}
      </span>
      <span
        className={
          strong
            ? "tabular text-[14px] font-bold text-ink"
            : tone === "success"
              ? "tabular text-[13px] font-semibold text-success-dark"
              : "tabular text-[13px] font-medium text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}
