import { Loader2 } from "lucide-react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { Logo } from "./components/Logo";
import { useAuth } from "./context/AuthContext";
import { AppLayout } from "./layouts/AppLayout";
import { BillPage } from "./pages/BillPage";
import { CheckInPage } from "./pages/CheckInPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { ChildrenPage } from "./pages/ChildrenPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LivePage } from "./pages/LivePage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F4F8F9]">
      <div className="flex flex-col items-center gap-4">
        <Logo size="lg" />
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Opening the play area…
        </div>
      </div>
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/live" replace />;
  return <Outlet />;
}

function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={user?.role === "admin" ? "/dashboard" : "/live"} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<RoleHome />} />
          <Route path="live" element={<LivePage />} />
          <Route path="check-in" element={<CheckInPage />} />
          <Route path="children" element={<ChildrenPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="checkout/:visitId" element={<CheckoutPage />} />
          <Route path="bills/:billId" element={<BillPage />} />

          <Route element={<RequireAdmin />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
