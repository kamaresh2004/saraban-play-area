import { ArrowLeft, Compass, Radio, SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../components/Button";
import { Logo } from "../components/Logo";
import { PageTransition } from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";

export function NotFoundPage() {
  const { user } = useAuth();

  return (
    <PageTransition className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Logo size="md" />
        </div>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-tint text-primary">
          <SearchX className="h-8 w-8" />
        </span>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          404 · Off the play mat
        </p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.04em] text-ink">
          This page isn&apos;t here
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          The link may be old, or the page may have moved. Let&apos;s get you back to the
          front desk.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link to={user ? "/live" : "/login"}>
            <Button size="lg" leftIcon={<Radio className="h-4 w-4" />} fullWidth>
              {user ? "Open live floor" : "Go to sign in"}
            </Button>
          </Link>
          <Link to={user ? "/dashboard" : "/login"}>
            <Button
              size="lg"
              variant="secondary"
              leftIcon={<Compass className="h-4 w-4" />}
              fullWidth
            >
              {user ? "Dashboard" : "Home"}
            </Button>
          </Link>
        </div>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-faint transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to start
        </Link>
      </div>
    </PageTransition>
  );
}
