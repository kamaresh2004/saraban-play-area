import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  LogIn,
  Phone,
  Search,
  Timer,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { Input } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { QrScanner } from "../components/QrScanner";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import {
  initials,
  money,
  planDurationLabel,
  timeOf,
} from "../lib/format";
import type { Child, Plan } from "../lib/types";
import { cn } from "../lib/utils";

export function CheckInPage() {
  const { success, warning, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selected, setSelected] = useState<Child | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [scanBusy, setScanBusy] = useState(false);

  const initialId = Number(searchParams.get("childId") ?? "0");
  const initialChild = useQuery({
    queryKey: ["child", initialId],
    queryFn: () => api.getChild(initialId),
    enabled: initialId > 0,
  });

  useEffect(() => {
    if (initialChild.data) setSelected(initialChild.data);
  }, [initialChild.data]);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: api.listPlans,
    staleTime: 60_000,
  });

  const activePlans = (plansQuery.data ?? []).filter((plan) => plan.is_active);

  useEffect(() => {
    if (planId === null && activePlans.length > 0) {
      setPlanId(activePlans[0].id);
    }
  }, [activePlans, planId]);

  const searchQuery = useQuery({
    queryKey: ["children", "checkin", submitted],
    queryFn: () =>
      /^\d{10}$/.test(submitted)
        ? api.listChildren({ phone: submitted })
        : api.listChildren({ q: submitted }),
    enabled: submitted.length >= 2,
    staleTime: 5_000,
  });

  const mutation = useMutation({
    mutationFn: () => api.checkIn(selected!.id, planId!),
    onSuccess: (visit) => {
      success(
        "Timer started",
        `${visit.child_name} · ${visit.plan_name}. Settle overtime and discounts at check-out.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["live"] });
      void queryClient.invalidateQueries({ queryKey: ["children"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      navigate("/live");
    },
    onError: (err: Error) => {
      toastError("Check-in failed", err.message);
    },
  });

  const chooseChild = (child: Child) => {
    setSelected(child);
    setSearchInput("");
    setSubmitted("");
    if (child.active_visit) {
      warning(
        "Already inside",
        `${child.name} was checked in at ${timeOf(child.active_visit.check_in_at)}.`,
      );
    }
  };

  const handleScan = async (text: string) => {
    setScanBusy(true);
    try {
      const child = await api.getChildByQr(text);
      chooseChild(child);
      success("QR matched", `${child.name} is ready to check in.`);
    } catch (err) {
      toastError("QR code not recognised", (err as Error).message);
    } finally {
      setScanBusy(false);
    }
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = searchInput.trim();
    if (term.length < 2) {
      toastError("Keep typing", "Enter a phone number or at least two letters of a name.");
      return;
    }
    setSubmitted(term);
  };

  const selectedPlan = activePlans.find((plan) => plan.id === planId) ?? null;
  const isInside = Boolean(selected?.active_visit);

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Reception"
        title="Check in a child"
        description="Scan the QR pass or search manually, choose a plan, and the backend starts the timer with the plan price saved on the visit."
        actions={
          <Badge tone="primary" dot>
            {scanBusy ? "Reading camera…" : "Ready to scan"}
          </Badge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <CardHeader
              title="Scan the QR pass"
              description="Hold the wristband inside the frame. The camera stops after a successful scan."
              icon={<Timer className="h-5 w-5" />}
            />
            <div className="mt-4">
              <QrScanner onScan={handleScan} disabled={scanBusy} />
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader
              title="Manual search"
              description="Fallback when the camera is unavailable: use the parent's phone or the child's name."
              icon={<Search className="h-5 w-5" />}
            />
            <form onSubmit={handleSearch} className="mt-4 flex gap-2">
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Phone number or child name"
                aria-label="Search by phone or name"
              />
              <Button type="submit" variant="secondary" className="shrink-0" aria-label="Search">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Search</span>
              </Button>
            </form>

            {submitted.length >= 2 ? (
              <div className="mt-4">
                {searchQuery.isLoading ? (
                  <p className="py-4 text-center text-xs text-ink-faint">Searching…</p>
                ) : searchQuery.isError ? (
                  <p className="py-4 text-center text-xs font-medium text-danger">
                    {(searchQuery.error as Error).message}
                  </p>
                ) : (searchQuery.data ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-ink/10 px-4 py-5 text-center">
                    <p className="text-[13px] font-semibold text-ink">No match found</p>
                    <p className="mt-1 text-[11px] text-ink-muted">
                      Check the number, or register the child first.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => navigate("/children")}
                    >
                      Register a child
                    </Button>
                  </div>
                ) : (
                  <ul className="max-h-[260px] space-y-2 overflow-y-auto pr-0.5">
                    {searchQuery.data?.map((child) => (
                      <li key={child.id}>
                        <button
                          type="button"
                          onClick={() => chooseChild(child)}
                          className="flex w-full items-center gap-3 rounded-xl border border-ink/[0.08] bg-white p-3 text-left transition hover:border-primary/40 hover:bg-tint/40"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tint text-[11px] font-bold text-primary-700">
                            {initials(child.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-ink">
                              {child.name}
                            </span>
                            <span className="block truncate text-[11px] text-ink-muted">
                              Age {child.age} · {child.parent_name}
                            </span>
                          </span>
                          {child.active_visit ? (
                            <Badge tone="success" dot>
                              Inside
                            </Badge>
                          ) : (
                            <ArrowRight className="h-4 w-4 text-ink-faint" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-faint">
                <Phone className="h-3.5 w-3.5" />
                Example: 9830012345 or “Myra”.
              </p>
            )}
          </Card>
        </div>

        <div>
          {!selected ? (
            <Card className="flex min-h-[440px] flex-col p-6">
              <EmptyState
                icon={UserRound}
                title="Select a child to begin"
                message="Scan a QR pass or search by phone/name. Their family details, active visit and plan options will appear here."
                className="flex-1 border-0 bg-transparent"
              />
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { icon: Timer, label: "30 min", value: money(150) },
                  { icon: Clock3, label: "1 hour", value: money(250) },
                  { icon: CheckCircle2, label: "Full day", value: money(500) },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-ink/[0.06] bg-[#FAFCFC] p-3 text-center"
                  >
                    <item.icon className="mx-auto h-4 w-4 text-primary" />
                    <p className="mt-1.5 text-[11px] font-medium text-ink-muted">{item.label}</p>
                    <p className="text-[13px] font-bold text-ink">{item.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="relative overflow-hidden bg-gradient-to-br from-tint via-white to-white p-5 sm:p-6">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-lg font-bold text-white shadow-[0_12px_24px_-12px_rgba(28,147,160,0.9)]">
                      {initials(selected.name)}
                    </span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                        Selected child
                      </p>
                      <h2 className="mt-0.5 text-xl font-extrabold tracking-[-0.02em] text-ink">
                        {selected.name}
                      </h2>
                      <p className="text-[12px] text-ink-muted">
                        Age {selected.age} · {selected.parent_name}
                      </p>
                      <p className="tabular text-[11px] text-ink-faint">+91 {selected.phone}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Clear selected child"
                    onClick={() => setSelected(null)}
                    className="focus-ring rounded-lg p-2 text-ink-faint transition hover:bg-white hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                {isInside && selected.active_visit ? (
                  <div className="rounded-2xl border border-amber/50 bg-amber-soft/70 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-dark shadow-sm">
                        <AlertTriangle className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-ink">Already checked in</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                          {selected.name} is on the {selected.active_visit.plan_name} plan,
                          checked in at {timeOf(selected.active_visit.check_in_at)}. Double
                          check-in is blocked.
                        </p>
                        <Button
                          size="md"
                          className="mt-3"
                          onClick={() =>
                            navigate(`/checkout/${selected.active_visit?.id}`)
                          }
                          leftIcon={<CheckCircle2 className="h-4 w-4" />}
                        >
                          Go to checkout
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : plansQuery.isLoading ? (
                  <LoadingState label="Loading plans…" className="min-h-[180px]" />
                ) : plansQuery.isError ? (
                  <ErrorState
                    title="Could not load plans"
                    message={(plansQuery.error as Error).message}
                    onRetry={() => void plansQuery.refetch()}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="label">Choose a play plan</p>
                      <span className="text-[10px] font-medium text-ink-faint">
                        Prices set by the owner
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                      {activePlans.map((plan) => (
                        <PlanOption
                          key={plan.id}
                          plan={plan}
                          selected={plan.id === planId}
                          onSelect={() => setPlanId(plan.id)}
                        />
                      ))}
                    </div>

                    {activePlans.length === 0 ? (
                      <EmptyState
                        title="No active plans"
                        message="The owner needs to activate a plan in settings."
                        className="mt-3 min-h-[140px]"
                      />
                    ) : (
                      <>
                        <div className="mt-4 flex items-center justify-between rounded-xl bg-ink/[0.035] px-4 py-3">
                          <div>
                            <p className="label">Plan price</p>
                            <p className="tabular text-xl font-extrabold text-ink">
                              {money(selectedPlan?.price ?? 0)}
                            </p>
                          </div>
                          <p className="max-w-[200px] text-right text-[10.5px] leading-relaxed text-ink-faint">
                            Overtime, grace and discounts are calculated at check-out on the
                            server.
                          </p>
                        </div>

                        <Button
                          size="xl"
                          fullWidth
                          className="mt-4"
                          loading={mutation.isPending}
                          disabled={planId === null}
                          onClick={() => mutation.mutate()}
                          leftIcon={<LogIn className="h-5 w-5" />}
                          rightIcon={<ArrowRight className="h-4 w-4" />}
                        >
                          Start timer
                        </Button>
                        <p className="mt-2 text-center text-[11px] text-ink-faint">
                          In-time is saved as soon as you start. Payment is collected at
                          check-out.
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function PlanOption({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative rounded-xl border p-3.5 text-left transition-all",
        selected
          ? "border-primary bg-tint shadow-[0_0_0_3px_rgba(28,147,160,0.1)]"
          : "border-ink/10 bg-white hover:border-primary/30 hover:bg-tint/30",
      )}
    >
      {plan.duration_minutes === null ? (
        <span className="absolute right-2 top-2 rounded-full bg-amber-soft px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-dark">
          Best value
        </span>
      ) : null}
      <span className="block text-[12px] font-semibold text-ink">{plan.name}</span>
      <span className="mt-0.5 block text-[10px] text-ink-faint">
        {planDurationLabel(plan.duration_minutes)}
      </span>
      <span className="mt-2 block text-[16px] font-extrabold tracking-[-0.02em] text-ink">
        {money(plan.price)}
      </span>
    </button>
  );
}
