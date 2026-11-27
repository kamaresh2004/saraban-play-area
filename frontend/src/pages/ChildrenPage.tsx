import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  LogIn,
  QrCode,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { Field, Input } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useToast } from "../context/ToastContext";
import { ChildQrDialog } from "../features/children/ChildQrDialog";
import { api } from "../lib/api";
import { initials, money, timeOf } from "../lib/format";
import type { Child, ChildPayload } from "../lib/types";
import { cn } from "../lib/utils";

const EMPTY_FORM = {
  name: "",
  age: "",
  parent_name: "",
  phone: "",
  consent: false,
};

export function ChildrenPage() {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);

  const [phoneInput, setPhoneInput] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [qrChild, setQrChild] = useState<Child | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const phone = phoneInput.replace(/\D/g, "").slice(0, 10);

  const searchQuery = useQuery({
    queryKey: ["children", "phone", phone],
    queryFn: () => api.listChildren({ phone }),
    enabled: phone.length === 10,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (phone.length === 10) {
      setForm((current) => (current.phone ? current : { ...current, phone }));
    }
  }, [phone]);

  const mutation = useMutation({
    mutationFn: (payload: ChildPayload) => api.createChild(payload),
    onSuccess: (child) => {
      success("Child registered", `${child.name}'s QR pass is ready to print.`);
      void queryClient.invalidateQueries({ queryKey: ["children"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setForm({ ...EMPTY_FORM, phone });
      setErrors({});
      setQrChild(child);
      setQrOpen(true);
    },
    onError: (err: Error) => {
      toastError("Could not register child", err.message);
    },
  });

  const update = (field: keyof typeof EMPTY_FORM, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = "Enter the child's full name.";
    const age = Number(form.age);
    if (!Number.isInteger(age) || age < 1 || age > 17) {
      nextErrors.age = "Age must be between 1 and 17.";
    }
    if (form.parent_name.trim().length < 2) {
      nextErrors.parent_name = "Enter the parent or guardian's name.";
    }
    const formPhone = form.phone.replace(/\D/g, "");
    if (formPhone.length !== 10) nextErrors.phone = "Phone must be exactly 10 digits.";
    if (!form.consent) nextErrors.consent = "Parental consent is required.";
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) return;
    mutation.mutate({
      name: form.name.trim(),
      age,
      parent_name: form.parent_name.trim(),
      phone: formPhone,
      consent_given: true,
    });
  };

  const focusForm = () => {
    setForm((current) => ({ ...current, phone }));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const results = searchQuery.data ?? [];
  const parent = results[0];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Families"
        title="Children"
        description="Find a returning family by phone, or register a new child in under a minute. Every child gets a unique printable QR pass."
        actions={
          <Badge tone="primary" dot>
            {results.length > 0 ? `${results.length} found` : "Reception desk"}
          </Badge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <CardHeader
              title="Find a returning child"
              description="Type the parent's 10-digit mobile number. Siblings appear together."
              icon={<Search className="h-5 w-5" />}
            />
            <div className="relative mt-4">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
                <span className="text-[12px] font-semibold">+91</span>
              </span>
              <Input
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                placeholder="98300 12345"
                inputMode="numeric"
                autoComplete="off"
                className="pl-12 text-base tracking-wide"
                aria-label="Parent phone number"
              />
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">
              {phone.length === 0
                ? "Search starts automatically after 10 digits."
                : phone.length < 10
                  ? `${10 - phone.length} more digit${10 - phone.length === 1 ? "" : "s"} needed.`
                  : "Searching all children registered with this number."}
            </p>
          </Card>

          {phone.length < 10 ? (
            <EmptyState
              icon={Users}
              title="Search a family"
              message="Enter the parent's phone number to see their children, QR passes and who is currently inside."
              className="min-h-[260px]"
            />
          ) : searchQuery.isLoading ? (
            <LoadingState label="Looking up this family…" />
          ) : searchQuery.isError ? (
            <ErrorState
              title="Could not search"
              message={(searchQuery.error as Error).message}
              onRetry={() => void searchQuery.refetch()}
            />
          ) : results.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No children found"
              message="This number is new to Saraban. Register the child using the form — the phone number is already filled in."
              action={
                <Button onClick={focusForm} leftIcon={<UserPlus className="h-4 w-4" />}>
                  Register this child
                </Button>
              }
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-ink/[0.06] bg-[#FAFCFC] px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                    Returning family
                  </p>
                  <p className="mt-0.5 text-[15px] font-bold text-ink">{parent?.parent_name}</p>
                  <p className="tabular text-xs text-ink-muted">+91 {parent?.phone}</p>
                </div>
                <Badge tone="neutral">
                  {results.length} child{results.length === 1 ? "" : "ren"}
                </Badge>
              </div>
              <ul className="divide-y divide-ink/[0.05]">
                {results.map((child) => (
                  <li key={child.id} className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tint text-[13px] font-bold text-primary-700">
                        {initials(child.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[15px] font-bold text-ink">{child.name}</p>
                          <span className="text-xs text-ink-faint">Age {child.age}</span>
                          {child.active_visit ? (
                            <Badge tone="success" dot>
                              Inside now
                            </Badge>
                          ) : null}
                        </div>
                        {child.active_visit ? (
                          <p className="mt-1 text-[12px] text-ink-muted">
                            {child.active_visit.plan_name} · in at{" "}
                            {timeOf(child.active_visit.check_in_at)}
                          </p>
                        ) : (
                          <p className="mt-1 text-[12px] text-ink-muted">
                            Registered {timeOf(child.created_at)}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setQrChild(child);
                              setQrOpen(true);
                            }}
                            leftIcon={<QrCode className="h-3.5 w-3.5" />}
                          >
                            QR pass
                          </Button>
                          {child.active_visit ? (
                            <Button
                              size="sm"
                              onClick={() => navigate(`/checkout/${child.active_visit?.id}`)}
                              leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                            >
                              Check out
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => navigate(`/check-in?childId=${child.id}`)}
                              leftIcon={<LogIn className="h-3.5 w-3.5" />}
                            >
                              Check in
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex items-start gap-2.5 rounded-2xl border border-primary/10 bg-tint/70 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-[12px] leading-relaxed text-primary-800/70">
              One parent can register many children on the same phone number. Play start
              prices are shown from {money(150)}.
            </p>
          </div>
        </div>

        <div ref={formRef}>
          <Card className="p-5 sm:p-6">
            <CardHeader
              title="Register a new child"
              description="Parental consent is mandatory before the first visit."
              icon={<UserPlus className="h-5 w-5" />}
            />

            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              <Field label="Child's full name" htmlFor="child-name" required error={errors.name}>
                <Input
                  id="child-name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="e.g. Myra Chatterjee"
                  invalid={Boolean(errors.name)}
                  autoComplete="off"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                <Field label="Age" htmlFor="child-age" required error={errors.age}>
                  <Input
                    id="child-age"
                    type="number"
                    min={1}
                    max={17}
                    value={form.age}
                    onChange={(event) => update("age", event.target.value)}
                    placeholder="5"
                    invalid={Boolean(errors.age)}
                  />
                </Field>
                <Field
                  label="Parent / guardian"
                  htmlFor="parent-name"
                  required
                  error={errors.parent_name}
                >
                  <Input
                    id="parent-name"
                    value={form.parent_name}
                    onChange={(event) => update("parent_name", event.target.value)}
                    placeholder="e.g. Arindam Chatterjee"
                    invalid={Boolean(errors.parent_name)}
                    autoComplete="off"
                  />
                </Field>
              </div>

              <Field
                label="Parent phone"
                htmlFor="parent-phone"
                required
                error={errors.phone}
                hint="Used to find the family on future visits."
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-faint">
                    +91
                  </span>
                  <Input
                    id="parent-phone"
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder="9830012345"
                    inputMode="numeric"
                    className="pl-12"
                    invalid={Boolean(errors.phone)}
                  />
                </div>
              </Field>

              <div>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
                    form.consent
                      ? "border-primary/30 bg-tint/70"
                      : "border-ink/10 bg-white hover:border-ink/20",
                    errors.consent && "border-danger/50 bg-danger-soft/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(event) => update("consent", event.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink/20 accent-[#1C93A0]"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Parental consent given
                    </span>
                    <span className="mt-1 block text-[11.5px] leading-relaxed text-ink-muted">
                      The parent or guardian confirms the child may play here, and that
                      staff may contact them about this visit.
                    </span>
                  </span>
                </label>
                {errors.consent ? (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                    {errors.consent}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                size="xl"
                fullWidth
                loading={mutation.isPending}
                leftIcon={<UserPlus className="h-5 w-5" />}
                rightIcon={<ArrowRight className="h-4 w-4" />}
                className="mt-1"
              >
                Register child
              </Button>
              <p className="text-center text-[11px] text-ink-faint">
                A unique QR pass is generated automatically.
              </p>
            </form>
          </Card>
        </div>
      </div>

      <ChildQrDialog child={qrChild} open={qrOpen} onClose={() => setQrOpen(false)} />
    </PageTransition>
  );
}
