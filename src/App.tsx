import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { StoreProvider, useStore } from "@/store/store";
import { AuthProvider } from "@/auth/AuthProvider";
import { AuthGuard } from "@/auth/AuthGuard";
import { LoginPage } from "@/auth/LoginPage";
import { Layout } from "@/components/layout/Layout";
import { DashboardPage } from "@/pages/Dashboard";
import { CalendarPage } from "@/pages/Calendar";
import { CustomersPage } from "@/pages/Customers";
import { CustomerDetailPage } from "@/pages/CustomerDetail";
import { LeadsPage } from "@/pages/Leads";
import { TasksPage } from "@/pages/Tasks";
import { ServicesPage } from "@/pages/Services";
import { TemplatesPage } from "@/pages/Templates";
import { RevenuePage } from "@/pages/Revenue";
import { ExpensesPage } from "@/pages/Expenses";
import { StartupPage } from "@/pages/Startup";
import { ChecklistsPage } from "@/pages/Checklists";
import { SettingsPage } from "@/pages/Settings";
import { CalculatorPage } from "@/pages/Calculator";

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
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/revenue" element={<RevenuePage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/startup" element={<StartupPage />} />
          <Route path="/checklists" element={<ChecklistsPage />} />
          <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
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
