import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { isAdminUser } from "@/lib/admin";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, configured, signOut } = useAuth();
  const location = useLocation();

  // If a non-admin somehow has a session, force them out so a stale token
  // can't keep them logged in across reloads.
  useEffect(() => {
    if (!loading && user && !isAdminUser(user)) {
      void signOut();
    }
  }, [loading, user, signOut]);

  if (!configured) {
    return <Navigate to="/book" replace />;
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Signing you in…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Anonymous visitors land on the public booking page. Admin reaches
    // /login directly when they want to sign in.
    return <Navigate to="/book" replace state={{ from: location }} />;
  }

  if (!isAdminUser(user)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}
