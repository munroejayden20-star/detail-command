import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { StoreProvider, useStore } from "@/store/store";
import { AuthProvider } from "@/auth/AuthProvider";
import { AuthGuard } from "@/auth/AuthGuard";
import { LoginPage } from "@/auth/LoginPage";
import { AuthCallback } from "@/auth/AuthCallback";
import { Layout } from "@/components/layout/Layout";
// Dashboard is the default landing page — keep it eager-loaded so the first
// paint is instant. Every other route is lazy so the initial bundle stays small.
import { DashboardPage } from "@/pages/Dashboard";

const BookingPage = lazy(() => import("@/pages/BookingPage").then((m) => ({ default: m.BookingPage })));
const BookingSuccessPage = lazy(() => import("@/pages/BookingSuccess").then((m) => ({ default: m.BookingSuccessPage })));
const BookingCancelPage = lazy(() => import("@/pages/BookingCancel").then((m) => ({ default: m.BookingCancelPage })));
const CalendarPage = lazy(() => import("@/pages/Calendar").then((m) => ({ default: m.CalendarPage })));
const CustomersPage = lazy(() => import("@/pages/Customers").then((m) => ({ default: m.CustomersPage })));
const CustomerDetailPage = lazy(() => import("@/pages/CustomerDetail").then((m) => ({ default: m.CustomerDetailPage })));
const LeadsPage = lazy(() => import("@/pages/Leads").then((m) => ({ default: m.LeadsPage })));
const TasksPage = lazy(() => import("@/pages/Tasks").then((m) => ({ default: m.TasksPage })));
const ServicesPage = lazy(() => import("@/pages/Services").then((m) => ({ default: m.ServicesPage })));
const RevenuePage = lazy(() => import("@/pages/Revenue").then((m) => ({ default: m.RevenuePage })));
const ExpensesPage = lazy(() => import("@/pages/Expenses").then((m) => ({ default: m.ExpensesPage })));
const ChecklistsPage = lazy(() => import("@/pages/Checklists").then((m) => ({ default: m.ChecklistsPage })));
const SettingsPage = lazy(() => import("@/pages/Settings").then((m) => ({ default: m.SettingsPage })));
const CalculatorPage = lazy(() => import("@/pages/Calculator").then((m) => ({ default: m.CalculatorPage })));
const PhotosPage = lazy(() => import("@/pages/Photos").then((m) => ({ default: m.PhotosPage })));
const WorkPage = lazy(() => import("@/pages/Work").then((m) => ({ default: m.WorkPage })));

function PageFallback() {
  return (
    <div className="grid place-items-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function lazyRoute(node: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          className: "!font-sans",
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/confirm" element={<AuthCallback />} />
        <Route path="/book" element={lazyRoute(<BookingPage />)} />
        <Route path="/booking/success" element={lazyRoute(<BookingSuccessPage />)} />
        <Route path="/booking/cancel" element={lazyRoute(<BookingCancelPage />)} />
        <Route
          element={
            <AuthGuard>
              <StoreProvider>
                <DataGate>
                  <Layout />
                </DataGate>
              </StoreProvider>
            </AuthGuard>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/calendar" element={lazyRoute(<CalendarPage />)} />
          <Route path="/customers" element={lazyRoute(<CustomersPage />)} />
          <Route path="/customers/:id" element={lazyRoute(<CustomerDetailPage />)} />
          <Route path="/leads" element={lazyRoute(<LeadsPage />)} />
          <Route path="/tasks" element={lazyRoute(<TasksPage />)} />
          <Route path="/services" element={lazyRoute(<ServicesPage />)} />
          <Route path="/revenue" element={lazyRoute(<RevenuePage />)} />
          <Route path="/expenses" element={lazyRoute(<ExpensesPage />)} />
          {/* /templates and /startup removed — redirecting to home */}
          <Route path="/templates" element={<Navigate to="/" replace />} />
          <Route path="/startup" element={<Navigate to="/" replace />} />
          <Route path="/checklists" element={lazyRoute(<ChecklistsPage />)} />
          <Route path="/calculator" element={lazyRoute(<CalculatorPage />)} />
          <Route path="/photos" element={lazyRoute(<PhotosPage />)} />
          <Route path="/work" element={lazyRoute(<WorkPage />)} />
          <Route path="/settings" element={lazyRoute(<SettingsPage />)} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

function DataGate({ children }: { children: React.ReactNode }) {
  const { loaded, loading, error, reload } = useStore();
  if (!loaded && loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading your data…</p>
        </div>
      </div>
    );
  }
  if (!loaded && error) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold">Could not load your data</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => reload()}
            className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
