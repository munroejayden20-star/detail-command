import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";

/**
 * Catch-all auth-callback route. Supabase's email-confirmation and magic-link
 * flows redirect here (or to the root) with a session token in the URL.
 * The Supabase client picks the token up via `detectSessionInUrl: true`,
 * which makes `useAuth()` return a user. Once it does, we send them home.
 */
export function AuthCallback() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    // Whether or not session detection succeeded, send them somewhere useful.
    navigate(user ? "/" : "/login", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Confirming your account…</p>
      </div>
    </div>
  );
}
