import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";

/**
 * Catch-all auth-callback route. Supabase's email-confirmation, magic-link
 * and password-recovery flows all redirect here (or to the root) with a
 * session token in the URL hash. The Supabase client picks the token up via
 * `detectSessionInUrl: true`, which makes `useAuth()` return a user (and
 * fires PASSWORD_RECOVERY for reset links).
 *
 * Branching:
 *   - `type=recovery` in the hash → /auth/reset to set a new password.
 *   - signed in normally           → /
 *   - no session                    → /login
 */
export function AuthCallback() {
  const { user, loading, recoveryFlow } = useAuth();
  const navigate = useNavigate();

  // Read the type once on mount — the hash gets cleared by the Supabase
  // client as soon as `detectSessionInUrl` exchanges it, so we have to
  // grab it before that happens.
  const initialType = useMemo(() => {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    return params.get("type");
  }, []);

  useEffect(() => {
    if (loading) return;
    if (initialType === "recovery" || recoveryFlow) {
      navigate("/auth/reset", { replace: true });
      return;
    }
    navigate(user ? "/" : "/login", { replace: true });
  }, [user, loading, recoveryFlow, initialType, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Confirming your account…</p>
      </div>
    </div>
  );
}
