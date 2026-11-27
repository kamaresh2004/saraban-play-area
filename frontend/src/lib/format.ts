export const IST = "Asia/Kolkata";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-IN");

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function money(value: number | string | null | undefined): string {
  return currencyFormatter.format(Number(value ?? 0));
}

export function number(value: number | string | null | undefined): string {
  return numberFormatter.format(Number(value ?? 0));
}

export function timeOf(iso: string | null | undefined): string {
  if (!iso) return "—";
  return timeFormatter.format(new Date(iso));
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return shortDateFormatter.format(new Date(iso));
}

export function weekdayDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return weekdayFormatter.format(new Date(iso));
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dateTimeFormatter.format(new Date(iso));
}

/** Local date input value (YYYY-MM-DD) in Asia/Kolkata. */
export function todayIst(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const find = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${find("year")}-${find("month")}-${find("day")}`;
}

/** Format a YYYY-MM-DD date string for display without time zone shifts. */
export function dateLabelFromIsoDate(value: string): string {
  if (!value) return "—";
  return shortDateFormatter.format(new Date(`${value}T12:00:00+05:30`));
}

export function minutesDuration(minutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(minutes ?? 0)));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

/** mm:ss below an hour, h:mm:ss above. Negative prefixes with a minus. */
export function clockFromSeconds(seconds: number): string {
  const negative = seconds < 0;
  const total = Math.abs(Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const body =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function planDurationLabel(durationMinutes: number | null): string {
  if (durationMinutes === null) return "Until closing";
  return minutesDuration(durationMinutes);
}

export function percent(value: number): string {
  return `${Math.round(value)}%`;
}
