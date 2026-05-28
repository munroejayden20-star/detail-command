import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  /** True from the moment Supabase fires PASSWORD_RECOVERY until the next
   *  successful password update or sign-out. Lets the reset page distinguish
   *  a real recovery session from a normal logged-in session. */
  recoveryFlow: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [recoveryFlow, setRecoveryFlow] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      // Supabase fires PASSWORD_RECOVERY exactly once when the user lands
      // from a reset email. We stash the flag so the reset page can render
      // its form even though the user technically has an active session.
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryFlow(true);
      } else if (event === "USER_UPDATED" || event === "SIGNED_OUT") {
        setRecoveryFlow(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "Supabase is not configured." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  // Customer-account signup for the public /book post-submit flow. Admin
  // access remains gated by the is_admin() RLS allowlist — anonymous
  // signups land as non-admin auth users and can only see the customer
  // portal, not /, /calendar, /customers, etc.
  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: "Supabase is not configured.", needsConfirmation: false };
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { error: error.message, needsConfirmation: false };
    }
    // Project may have "Confirm email" enabled in Supabase Auth settings.
    // In that case `session` is null until the user clicks the link.
    const needsConfirmation = !data.session;
    return { error: null, needsConfirmation };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) return { error: "Supabase is not configured." };
    // shouldCreateUser:false prevents magic links from creating new accounts
    // for unknown emails — only existing (admin) users can request one.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: false,
      },
    });
    return { error: error?.message ?? null };
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabase) return { error: "Supabase is not configured." };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!supabase) return { error: "Supabase is not configured." };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setRecoveryFlow(false);
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setRecoveryFlow(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      configured: isSupabaseConfigured,
      recoveryFlow,
      signIn,
      signUp,
      signInWithMagicLink,
      sendPasswordReset,
      updatePassword,
      signOut,
    }),
    [session, loading, recoveryFlow, signIn, signUp, signInWithMagicLink, sendPasswordReset, updatePassword, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
