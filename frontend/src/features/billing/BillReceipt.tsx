import { dateTime, money, timeOf } from "../../lib/format";
import type { Bill, Settings } from "../../lib/types";
import { cn } from "../../lib/utils";

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className={cn("text-[11px]", strong ? "font-semibold text-ink" : "text-ink-muted")}>
        {label}
      </span>
      <span className={cn("tabular text-right text-[11px] text-ink", strong && "font-semibold")}>
        {value}
      </span>
    </div>
  );
}

export function BillReceipt({
  bill,
  settings,
  className,
}: {
  bill: Bill;
  settings?: Settings | null;
  className?: string;
}) {
  const businessName = settings?.business_name ?? "Saraban Play Area";
  const payment = bill.payment_method === "cash" ? "CASH" : "UPI";

  return (
    <div
      className={cn(
        "print-area mx-auto w-full max-w-[330px] bg-white px-5 py-6 text-ink",
        className,
      )}
    >
      <div className="text-center">
        <p className="text-[17px] font-extrabold uppercase leading-tight tracking-[-0.02em]">
          {businessName}
        </p>
        {settings?.business_tagline ? (
          <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            {settings.business_tagline}
          </p>
        ) : null}
        {settings?.business_address ? (
          <p className="mx-auto mt-2 max-w-[250px] text-[10px] leading-snug text-ink-muted">
            {settings.business_address}
          </p>
        ) : null}
        {settings?.business_phone ? (
          <p className="tabular mt-1 text-[10px] text-ink-muted">{settings.business_phone}</p>
        ) : null}
      </div>

      <div className="print-divider my-3 border-t border-dashed border-ink/25" />

      <div className="space-y-1">
        <div className="flex justify-between gap-3 text-[11px]">
          <span className="text-ink-muted">Bill no.</span>
          <span className="tabular font-bold">{bill.bill_number}</span>
        </div>
        <div className="flex justify-between gap-3 text-[11px]">
          <span className="text-ink-muted">Date</span>
          <span className="tabular text-right">{dateTime(bill.paid_at)}</span>
        </div>
        <div className="flex justify-between gap-3 text-[11px]">
          <span className="text-ink-muted">Served by</span>
          <span className="text-right">{bill.staff_name}</span>
        </div>
      </div>

      <div className="print-divider my-3 border-t border-dashed border-ink/25" />

      <div className="space-y-0.5">
        <p className="text-[13px] font-bold">{bill.child_name}</p>
        <p className="text-[10px] text-ink-muted">
          Parent: {bill.parent_name} · +91 {bill.phone}
        </p>
        <p className="text-[10px] text-ink-muted">
          In {timeOf(bill.check_in_at)} · Out {timeOf(bill.check_out_at)} ·{" "}
          {bill.play_minutes} min played
        </p>
      </div>

      <div className="print-divider my-3 border-t border-dashed border-ink/25" />

      <div className="flex items-center justify-between gap-3 py-1 text-[11px]">
        <span className="font-medium">{bill.plan_name}</span>
        <span className="tabular">{money(bill.plan_price)}</span>
      </div>

      {bill.overtime_amount > 0 ? (
        <div className="flex items-center justify-between gap-3 py-1 text-[11px]">
          <span className="text-ink-muted">
            Overtime · {bill.overtime_minutes} min
          </span>
          <span className="tabular">{money(bill.overtime_amount)}</span>
        </div>
      ) : null}

      <div className="print-divider my-2 border-t border-dashed border-ink/25" />

      <Row label="Subtotal" value={money(bill.subtotal)} />
      {bill.discount_amount > 0 ? (
        <Row
          label={
            bill.discount_type === "percent"
              ? `Discount (${bill.discount_value}%)`
              : "Discount"
          }
          value={`− ${money(bill.discount_amount)}`}
        />
      ) : null}

      <div className="mt-2 flex items-center justify-between border-y border-dashed border-ink/30 py-2.5">
        <span className="text-[12px] font-bold uppercase tracking-[0.08em]">Total</span>
        <span className="tabular text-[19px] font-extrabold tracking-[-0.02em]">
          {money(bill.amount)}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px]">
        <span className="text-ink-muted">Paid by</span>
        <span className="font-bold tracking-wide">{payment}</span>
      </div>

      {bill.discount_type === "percent" ? (
        <p className="mt-1 text-[9px] text-ink-faint">
          Discount applied: {bill.discount_value}% ({money(bill.discount_amount)})
        </p>
      ) : null}

      <div className="print-divider my-3 border-t border-dashed border-ink/25" />

      <div className="text-center">
        <p className="text-[10px] leading-snug text-ink-muted">
          {settings?.bill_footer ?? "Thank you for playing with us. See you soon!"}
        </p>
        <p className="mt-2 text-[8px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
          Saraban Play Area
        </p>
      </div>
    </div>
  );
}
