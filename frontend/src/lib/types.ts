export type Role = "admin" | "reception";
export type PaymentMethod = "cash" | "upi";
export type DiscountType = "none" | "flat" | "percent";
export type AlertLevel = "ok" | "warning" | "overdue";
export type VisitStatus = "active" | "completed";

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: Role;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ActiveVisitBrief {
  id: number;
  plan_name: string;
  check_in_at: string;
  planned_end_at: string;
}

export interface Child {
  id: number;
  name: string;
  age: number;
  parent_name: string;
  phone: string;
  consent_given: boolean;
  qr_code: string;
  created_at: string;
  active_visit: ActiveVisitBrief | null;
}

export interface ChildPayload {
  name: string;
  age: number;
  parent_name: string;
  phone: string;
  consent_given: boolean;
}

export interface Plan {
  id: number;
  code: string;
  name: string;
  price: number;
  duration_minutes: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface PlanUpdatePayload {
  name?: string;
  price?: number;
  duration_minutes?: number;
  is_active?: boolean;
}

export interface LiveVisit {
  id: number;
  child_id: number;
  child_name: string;
  child_age: number;
  parent_name: string;
  phone: string;
  qr_code: string;
  plan_code: string;
  plan_name: string;
  plan_price: number;
  booked_minutes: number;
  check_in_at: string;
  planned_end_at: string;
  elapsed_seconds: number;
  elapsed_minutes: number;
  remaining_seconds: number;
  remaining_minutes: number;
  progress_percent: number;
  alert: AlertLevel;
}

export interface LiveResponse {
  server_now: string;
  clock_offset_minutes: number;
  warning_count: number;
  overdue_count: number;
  visits: LiveVisit[];
}

export interface VisitDetail {
  id: number;
  status: VisitStatus;
  child_id: number;
  child_name: string;
  child_age: number;
  parent_name: string;
  phone: string;
  qr_code: string;
  plan_code: string;
  plan_name: string;
  plan_price: number;
  booked_minutes: number;
  check_in_at: string;
  planned_end_at: string;
  check_out_at: string | null;
  overtime_minutes: number;
  overtime_amount: number;
  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  total_amount: number;
  bill_id: number | null;
}

export interface Quote {
  plan_price: number;
  booked_minutes: number;
  elapsed_minutes: number;
  overtime_minutes: number;
  overtime_blocks: number;
  overtime_amount: number;
  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  total: number;
  grace_minutes: number;
  overtime_rate: number;
  overtime_block_minutes: number;
  check_in_at: string;
  planned_end_at: string;
  check_out_at: string | null;
}

export interface CheckoutPayload {
  payment_method: PaymentMethod;
  discount_type: DiscountType;
  discount_value: number;
}

export interface Bill {
  id: number;
  bill_number: string;
  visit_id: number;
  child_name: string;
  parent_name: string;
  phone: string;
  plan_name: string;
  staff_name: string;
  payment_method: PaymentMethod;
  paid_at: string;
  check_in_at: string;
  check_out_at: string;
  play_minutes: number;
  plan_price: number;
  booked_minutes: number;
  overtime_minutes: number;
  overtime_amount: number;
  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  total_amount: number;
  amount: number;
}

export interface CollectionSplit {
  cash: number;
  upi: number;
  total: number;
}

export interface DailyReport {
  date: string;
  visits_count: number;
  completed_visits: number;
  active_visits: number;
  total_playtime_minutes: number;
  bills_count: number;
  collection: CollectionSplit;
  bills: Bill[];
}

export interface WeekPoint {
  date: string;
  label: string;
  visits: number;
  collection: number;
}

export interface DashboardData {
  inside_now: number;
  warning_count: number;
  overdue_count: number;
  today_visits: number;
  today_collection: number;
  today_cash: number;
  today_upi: number;
  average_play_minutes: number;
  week: WeekPoint[];
  recent_bills: Bill[];
  plans: Plan[];
}

export interface Settings {
  business_name: string;
  business_tagline: string;
  business_address: string;
  business_phone: string;
  bill_footer: string;
  closing_time: string;
  grace_minutes: number;
  overtime_rate: number;
  overtime_block_minutes: number;
  clock_offset_minutes: number;
  updated_at: string;
}

export interface SettingsPayload {
  business_name?: string;
  business_tagline?: string;
  business_address?: string;
  business_phone?: string;
  bill_footer?: string;
  closing_time?: string;
  grace_minutes?: number;
  overtime_rate?: number;
  overtime_block_minutes?: number;
}

export interface DemoClock {
  offset_minutes: number;
  server_now: string;
}
