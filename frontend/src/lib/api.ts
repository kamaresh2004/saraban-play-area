import type {
  Bill,
  Child,
  ChildPayload,
  CheckoutPayload,
  DailyReport,
  DashboardData,
  DemoClock,
  LiveResponse,
  LiveVisit,
  LoginResponse,
  Plan,
  PlanUpdatePayload,
  Quote,
  Settings,
  SettingsPayload,
  User,
  VisitDetail,
} from "./types";

function resolveApiBase(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!configured) return "http://localhost:8000/api";

  const base = configured.replace(/\/+$/, "");
  // Accept either a full API base (…/api) or just the service origin.
  return base.endsWith("/api") ? base : `${base}/api`;
}

export const API_BASE: string = resolveApiBase();

const TOKEN_KEY = "saraban.token";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

function extractMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : null,
      )
      .filter(Boolean);
    if (messages.length) return messages.join(" ");
  }
  return fallback;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Is the backend running on port 8000?",
      0,
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
      window.dispatchEvent(new Event("saraban:unauthorized"));
    }
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new ApiError(
      extractMessage(payload, `Something went wrong (${response.status}).`),
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function downloadDailyCsv(date: string): Promise<void> {
  const token = getToken();
  const response = await fetch(
    `${API_BASE}/reports/daily.csv?date=${encodeURIComponent(date)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!response.ok) {
    throw new ApiError("Could not export the report. Please try again.", response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `saraban-report-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  login(username: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },

  me(): Promise<User> {
    return request<User>("/auth/me");
  },

  listChildren(params: { phone?: string; q?: string } = {}): Promise<Child[]> {
    const search = new URLSearchParams();
    if (params.phone) search.set("phone", params.phone);
    if (params.q) search.set("q", params.q);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<Child[]>(`/children${suffix}`);
  },

  createChild(payload: ChildPayload): Promise<Child> {
    return request<Child>("/children", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getChild(id: number): Promise<Child> {
    return request<Child>(`/children/${id}`);
  },

  getChildByQr(code: string): Promise<Child> {
    return request<Child>(`/children/qr/${encodeURIComponent(code)}`);
  },

  listPlans(): Promise<Plan[]> {
    return request<Plan[]>("/plans");
  },

  updatePlan(id: number, payload: PlanUpdatePayload): Promise<Plan> {
    return request<Plan>(`/plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  getLive(): Promise<LiveResponse> {
    return request<LiveResponse>("/visits/active");
  },

  checkIn(childId: number, planId: number): Promise<LiveVisit> {
    return request<LiveVisit>("/visits/check-in", {
      method: "POST",
      body: JSON.stringify({ child_id: childId, plan_id: planId }),
    });
  },

  getVisit(id: number): Promise<VisitDetail> {
    return request<VisitDetail>(`/visits/${id}`);
  },

  getQuote(
    id: number,
    discountType: "none" | "flat" | "percent",
    discountValue: number,
  ): Promise<Quote> {
    const search = new URLSearchParams({
      discount_type: discountType,
      discount_value: String(discountValue),
    });
    return request<Quote>(`/visits/${id}/quote?${search.toString()}`);
  },

  checkout(id: number, payload: CheckoutPayload): Promise<Bill> {
    return request<Bill>(`/visits/${id}/checkout`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listBills(limit = 10): Promise<Bill[]> {
    return request<Bill[]>(`/bills?limit=${limit}`);
  },

  getBill(id: number): Promise<Bill> {
    return request<Bill>(`/bills/${id}`);
  },

  getDailyReport(date: string): Promise<DailyReport> {
    return request<DailyReport>(`/reports/daily?date=${encodeURIComponent(date)}`);
  },

  getDashboard(): Promise<DashboardData> {
    return request<DashboardData>("/dashboard");
  },

  getSettings(): Promise<Settings> {
    return request<Settings>("/settings");
  },

  updateSettings(payload: SettingsPayload): Promise<Settings> {
    return request<Settings>("/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  fastForward(minutes: number): Promise<DemoClock> {
    return request<DemoClock>("/demo/fast-forward", {
      method: "POST",
      body: JSON.stringify({ minutes }),
    });
  },

  resetClock(): Promise<DemoClock> {
    return request<DemoClock>("/demo/reset-clock", { method: "POST" });
  },
};
