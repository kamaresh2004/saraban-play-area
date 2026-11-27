import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeIndianRupee,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Percent,
  ReceiptText,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Timer,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { Field, Input, Textarea } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { ErrorState, LoadingState } from "../components/States";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { money, timeOf } from "../lib/format";
import type { Plan, Settings, SettingsPayload } from "../lib/types";
import { cn } from "../lib/utils";

type FormState = {
  business_name: string;
  business_tagline: string;
  business_address: string;
  business_phone: string;
  bill_footer: string;
  closing_time: string;
  grace_minutes: string;
  overtime_rate: string;
  overtime_block_minutes: string;
};

function toForm(settings: Settings): FormState {
  return {
    business_name: settings.business_name,
    business_tagline: settings.business_tagline,
    business_address: settings.business_address,
    business_phone: settings.business_phone,
    bill_footer: settings.bill_footer,
    closing_time: settings.closing_time,
    grace_minutes: String(settings.grace_minutes),
    overtime_rate: String(settings.overtime_rate),
    overtime_block_minutes: String(settings.overtime_block_minutes),
  };
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: api.listPlans,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [planDrafts, setPlanDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    if (settingsQuery.data && !form) setForm(toForm(settingsQuery.data));
  }, [settingsQuery.data, form]);

  useEffect(() => {
    if (plansQuery.data) {
      setPlanDrafts((current) => {
        const next: Record<number, string> = {};
        for (const plan of plansQuery.data) next[plan.id] = current[plan.id] ?? String(plan.price);
        return next;
      });
    }
  }, [plansQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: SettingsPayload) => api.updateSettings(payload),
    onSuccess: (updated) => {
      success("Settings saved", "Billing and receipts now use the new values.");
      setForm(toForm(updated));
      setErrors({});
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["live"] });
    },
    onError: (err: Error) => toastError("Could not save settings", err.message),
  });

  const planMutation = useMutation({
    mutationFn: (payload: { id: number; price?: number; is_active?: boolean }) =>
      api.updatePlan(payload.id, {
        price: payload.price,
        is_active: payload.is_active,
      }),
    onSuccess: (plan) => {
      success("Plan updated", `${plan.name} · ${money(plan.price)} · ${plan.is_active ? "active" : "hidden"}.`);
      setPlanDrafts((current) => ({ ...current, [plan.id]: String(plan.price) }));
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => toastError("Could not update plan", err.message),
  });

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;

    const nextErrors: Record<string, string> = {};
    if (form.business_name.trim().length < 2) {
      nextErrors.business_name = "Business name is required.";
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.closing_time)) {
      nextErrors.closing_time = "Use a 24-hour time like 20:00.";
    }
    const grace = Number(form.grace_minutes);
    if (!Number.isInteger(grace) || grace < 0 || grace > 60) {
      nextErrors.grace_minutes = "Grace must be between 0 and 60 minutes.";
    }
    const rate = Number(form.overtime_rate);
    if (!Number.isFinite(rate) || rate < 0) {
      nextErrors.overtime_rate = "Enter a valid overtime rate.";
    }
    const block = Number(form.overtime_block_minutes);
    if (!Number.isInteger(block) || block < 1 || block > 120) {
      nextErrors.overtime_block_minutes = "Block must be between 1 and 120 minutes.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    saveMutation.mutate({
      business_name: form.business_name.trim(),
      business_tagline: form.business_tagline.trim(),
      business_address: form.business_address.trim(),
      business_phone: form.business_phone.trim(),
      bill_footer: form.bill_footer.trim(),
      closing_time: form.closing_time,
      grace_minutes: grace,
      overtime_rate: rate,
      overtime_block_minutes: block,
    });
  };

  const savePlanPrice = (plan: Plan) => {
    const draft = planDrafts[plan.id] ?? String(plan.price);
    const price = Number(draft);
    if (!Number.isFinite(price) || price < 0) {
      toastError("Invalid price", "Enter a price of zero or more.");
      return;
    }
    if (price === plan.price) return;
    planMutation.mutate({ id: plan.id, price });
  };

  if (settingsQuery.isLoading) {
    return (
      <PageTransition>
        <LoadingState label="Loading settings…" className="min-h-[420px]" />
      </PageTransition>
    );
  }

  if (settingsQuery.isError || !form) {
    return (
      <PageTransition>
        <ErrorState
          title="Could not load settings"
          message={(settingsQuery.error as Error)?.message}
          onRetry={() => void settingsQuery.refetch()}
        />
      </PageTransition>
    );
  }

  const settings = settingsQuery.data;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Owner only"
        title="Settings"
        description="Business details printed on receipts, overtime rules, and plan prices. Changes apply to new visits — completed bills never change."
        actions={
          <Badge tone="primary" dot>
            <ShieldCheck className="mr-0.5 h-3 w-3" />
            Admin
          </Badge>
        }
      />

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* Business */}
        <div className="space-y-4">
          <Card className="p-5 sm:p-6">
            <CardHeader
              title="Business details"
              description="Shown at the top of every 80 mm receipt."
              icon={<Building2 className="h-5 w-5" />}
            />
            <div className="mt-5 space-y-4">
              <Field
                label="Business name"
                htmlFor="business-name"
                required
                error={errors.business_name}
              >
                <Input
                  id="business-name"
                  value={form.business_name}
                  onChange={(event) => update("business_name", event.target.value)}
                  invalid={Boolean(errors.business_name)}
                />
              </Field>

              <Field label="Tagline" htmlFor="business-tagline">
                <Input
                  id="business-tagline"
                  value={form.business_tagline}
                  onChange={(event) => update("business_tagline", event.target.value)}
                  placeholder="Where little adventures begin"
                />
              </Field>

              <Field label="Address" htmlFor="business-address">
                <Textarea
                  id="business-address"
                  value={form.business_address}
                  onChange={(event) => update("business_address", event.target.value)}
                  className="min-h-20"
                />
              </Field>

              <Field label="Phone" htmlFor="business-phone">
                <Input
                  id="business-phone"
                  value={form.business_phone}
                  onChange={(event) => update("business_phone", event.target.value)}
                  placeholder="+91 98300 00000"
                />
              </Field>

              <Field
                label="Receipt footer message"
                htmlFor="bill-footer"
                hint="A short thank-you printed at the bottom of the bill."
              >
                <Textarea
                  id="bill-footer"
                  value={form.bill_footer}
                  onChange={(event) => update("bill_footer", event.target.value)}
                  className="min-h-16"
                />
              </Field>
            </div>
          </Card>

          {/* Receipt preview hint */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-primary/10 bg-tint/70 px-4 py-3">
            <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-[12px] leading-relaxed text-primary-800/70">
              Receipts are printed at 80 mm. Keep the tagline and footer short so they fit
              on one slip. {settings ? `Last updated ${timeOf(settings.updated_at)} IST.` : ""}
            </p>
          </div>
        </div>

        {/* Billing */}
        <div className="space-y-4">
          <Card className="p-5 sm:p-6">
            <CardHeader
              title="Billing rules"
              description="Used for every new checkout quote and bill."
              icon={<Clock3 className="h-5 w-5" />}
            />
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Closing time"
                  htmlFor="closing-time"
                  required
                  error={errors.closing_time}
                  hint="24-hour clock, IST"
                >
                  <Input
                    id="closing-time"
                    type="time"
                    value={form.closing_time}
                    onChange={(event) => update("closing_time", event.target.value)}
                    invalid={Boolean(errors.closing_time)}
                  />
                </Field>

                <Field
                  label="Grace period"
                  htmlFor="grace-minutes"
                  required
                  error={errors.grace_minutes}
                  hint="Free minutes after the booked time"
                >
                  <div className="relative">
                    <Input
                      id="grace-minutes"
                      type="number"
                      min={0}
                      max={60}
                      value={form.grace_minutes}
                      onChange={(event) => update("grace_minutes", event.target.value)}
                      className="pr-14"
                      invalid={Boolean(errors.grace_minutes)}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-ink-faint">
                      min
                    </span>
                  </div>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Overtime rate"
                  htmlFor="overtime-rate"
                  required
                  error={errors.overtime_rate}
                  hint="Charged per started block"
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-faint">
                      ₹
                    </span>
                    <Input
                      id="overtime-rate"
                      type="number"
                      min={0}
                      step={10}
                      value={form.overtime_rate}
                      onChange={(event) => update("overtime_rate", event.target.value)}
                      className="pl-9"
                      invalid={Boolean(errors.overtime_rate)}
                    />
                  </div>
                </Field>

                <Field
                  label="Overtime block"
                  htmlFor="overtime-block"
                  required
                  error={errors.overtime_block_minutes}
                  hint="Each started block is billed"
                >
                  <div className="relative">
                    <Input
                      id="overtime-block"
                      type="number"
                      min={1}
                      max={120}
                      value={form.overtime_block_minutes}
                      onChange={(event) =>
                        update("overtime_block_minutes", event.target.value)
                      }
                      className="pr-14"
                      invalid={Boolean(errors.overtime_block_minutes)}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-ink-faint">
                      min
                    </span>
                  </div>
                </Field>
              </div>

              <div className="rounded-xl border border-ink/[0.08] bg-[#FAFCFC] p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  <Percent className="h-3.5 w-3.5 text-primary" />
                  Example
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                  A 60-minute plan that runs{" "}
                  <span className="font-semibold text-ink">
                    {Number(form.grace_minutes || 0) + Number(form.overtime_block_minutes || 0) + 1} minutes
                  </span>{" "}
                  over gets {Number(form.grace_minutes || 0)} free minutes, then one started{" "}
                  {form.overtime_block_minutes || 0}-minute block is added for{" "}
                  <span className="font-semibold text-ink">
                    {money(Number(form.overtime_rate || 0))}
                  </span>
                  .
                </p>
              </div>
            </div>
          </Card>

          <Button
            type="submit"
            size="xl"
            fullWidth
            loading={saveMutation.isPending}
            leftIcon={<Save className="h-5 w-5" />}
          >
            Save settings
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            leftIcon={<Undo2 className="h-4 w-4" />}
            onClick={() => {
              if (settings) {
                setForm(toForm(settings));
                setErrors({});
              }
            }}
          >
            Discard unsaved changes
          </Button>
        </div>
      </form>

      {/* Plans */}
      <Card className="p-5 sm:p-6">
        <CardHeader
          title="Play plans"
          description="Prices apply to new check-ins. Hide a plan to remove it from the check-in screen."
          icon={<BadgeIndianRupee className="h-5 w-5" />}
          action={<Badge tone="neutral">{plans.length} plans</Badge>}
        />

        {plansQuery.isLoading ? (
          <LoadingState label="Loading plans…" className="mt-4 min-h-[160px]" />
        ) : plansQuery.isError ? (
          <ErrorState
            title="Could not load plans"
            message={(plansQuery.error as Error)?.message}
            onRetry={() => void plansQuery.refetch()}
            className="mt-4"
          />
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {plans.map((plan) => {
              const draft = planDrafts[plan.id] ?? String(plan.price);
              const dirty = Number(draft) !== plan.price;
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-2xl border p-4 transition",
                    plan.is_active
                      ? "border-ink/[0.08] bg-white"
                      : "border-dashed border-ink/15 bg-ink/[0.02]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-bold text-ink">{plan.name}</p>
                      <p className="text-[10.5px] text-ink-faint">
                        {plan.duration_minutes === null
                          ? "Until closing"
                          : `${plan.duration_minutes} minutes`}{" "}
                        · {plan.code}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={plan.is_active}
                      aria-label={`Toggle ${plan.name}`}
                      onClick={() =>
                        planMutation.mutate({ id: plan.id, is_active: !plan.is_active })
                      }
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition",
                        plan.is_active ? "bg-primary" : "bg-ink/20",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
                          plan.is_active ? "left-[22px]" : "left-0.5",
                        )}
                      />
                    </button>
                  </div>

                  <div className="mt-3 flex gap-2">
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
                      onClick={() => savePlanPrice(plan)}
                      className="h-10 shrink-0"
                    >
                      Save
                    </Button>
                  </div>

                  <p className="mt-2 flex items-center gap-1 text-[10.5px] text-ink-faint">
                    {plan.is_active ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        Available at check-in
                      </>
                    ) : (
                      <>
                        <Timer className="h-3 w-3" />
                        Hidden from check-in
                      </>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex items-start gap-2.5 rounded-2xl border border-ink/[0.06] bg-white/70 px-4 py-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
        <p className="text-[11.5px] leading-relaxed text-ink-muted">
          All times and dates are handled in Asia/Kolkata. Bills and visits keep the plan
          price they were created with, so future price changes are safe.
        </p>
      </div>

      <p className="text-center text-[11px] text-ink-faint">
        <SettingsIcon className="mr-1 inline h-3 w-3" />
        Signed in as an owner. Reception staff cannot open this page.
      </p>
    </PageTransition>
  );
}
