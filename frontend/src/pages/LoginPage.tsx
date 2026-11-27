import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { Button } from "../components/Button";
import { Field, Input } from "../components/Field";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { cn } from "../lib/utils";

const FEATURES = [
  {
    icon: QrCode,
    title: "Scan. Play. Repeat.",
    text: "Unique QR passes get children checked in in seconds.",
  },
  {
    icon: Timer,
    title: "Live timers that warn you",
    text: "Amber at 10 minutes, red when a visit runs over.",
  },
  {
    icon: ReceiptText,
    title: "Bills without maths",
    text: "Grace periods, overtime and discounts calculated server-side.",
  },
];

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={user.role === "admin" ? "/dashboard" : "/live"} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Enter both username and password to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const loggedIn = await login(username.trim(), password);
      success(
        `Welcome back, ${loggedIn.full_name.split(" ")[0]}`,
        loggedIn.role === "admin" ? "Owner dashboard unlocked." : "Reception desk ready.",
      );
      navigate(loggedIn.role === "admin" ? "/dashboard" : "/live", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fill = (nextUsername: string, nextPassword: string) => {
    setUsername(nextUsername);
    setPassword(nextPassword);
    setError(null);
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.06fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-[420px] w-[420px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-16 top-24 h-32 w-32 rounded-full border border-white/10" />
        <div className="absolute right-8 top-40 h-52 w-52 rounded-full border border-white/[0.06]" />
        <div className="absolute bottom-24 right-20 h-3 w-3 rounded-full bg-amber/80" />
        <div className="absolute right-44 top-20 h-2 w-2 rounded-full bg-white/40" />
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_10%,rgba(28,147,160,0.28),transparent_60%)]" />

        <div className="relative z-10 flex h-full flex-col p-10 xl:p-14">
          <Logo variant="light" size="md" />
          <div className="my-auto max-w-lg py-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-100 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-amber" />
              Built for busy front desks
            </span>
            <h1 className="mt-6 text-[46px] font-extrabold leading-[1.02] tracking-[-0.05em] text-white xl:text-[54px]">
              Every child&apos;s playtime,
              <span className="block text-primary-200">perfectly in hand.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
              Registration, QR check-in, live timers and automatic billing for Saraban
              Play Area — all in one calm, quick counter app.
            </p>

            <ul className="mt-8 space-y-4">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex gap-3.5">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-primary-100">
                    <feature.icon className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-white">{feature.title}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">
                      {feature.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-10 max-w-sm rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Live floor preview
                </p>
                <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  6 inside
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { name: "Myra C.", time: "08:12 left", tone: "text-amber" },
                  { name: "Advik R.", time: "08:15 over", tone: "text-red-400" },
                  { name: "Diya S.", time: "39:40 left", tone: "text-white/80" },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-xl bg-white/[0.045] px-3 py-2"
                  >
                    <span className="text-[12px] font-medium text-white/80">{row.name}</span>
                    <span className={cn("tabular text-[12px] font-semibold", row.tone)}>
                      {row.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-white/35">
            <ShieldCheck className="h-3.5 w-3.5" />
            Demo environment · passwords are hashed · no real payments
          </div>
        </div>
      </section>

      {/* Form panel */}
      <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <Logo size="md" />
          </div>

          <div className="mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Staff access
            </p>
            <h2 className="mt-2 text-[30px] font-extrabold tracking-[-0.04em] text-ink">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              Sign in to the reception counter or owner dashboard.
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger/15 bg-danger-soft/70 px-3.5 py-3 text-[13px] font-medium text-danger-dark"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field label="Username" htmlFor="username" required>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                placeholder="admin"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                invalid={Boolean(error)}
              />
            </Field>

            <Field label="Password" htmlFor="password" required>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-12"
                  invalid={Boolean(error)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-faint hover:text-ink"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Button
              type="submit"
              size="xl"
              fullWidth
              loading={submitting}
              rightIcon={<ArrowRight className="h-[18px] w-[18px]" />}
              className="mt-2"
            >
              Sign in
            </Button>
          </form>

          <div className="mt-7">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-ink/[0.07]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                Demo accounts
              </span>
              <span className="h-px flex-1 bg-ink/[0.07]" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                {
                  label: "Owner",
                  username: "admin",
                  password: "admin123",
                },
                {
                  label: "Reception",
                  username: "reception",
                  password: "reception123",
                },
              ].map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => fill(account.username, account.password)}
                  className="group rounded-xl border border-ink/10 bg-white px-3.5 py-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-soft"
                >
                  <span className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                      {account.label}
                    </span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-ink-faint transition group-hover:text-primary" />
                  </span>
                  <span className="mt-1 block font-mono text-[12px] font-semibold text-ink">
                    {account.username} / {account.password}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-ink-faint">
              Click a demo account to fill the form instantly.
            </p>
          </div>

          <p className="mt-10 text-center text-[11px] text-ink-faint">
            Saraban Play Area · Demo build · All times in IST
          </p>
        </div>
      </section>
    </div>
  );
}
