import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "./AuthProvider";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "magic";

export function LoginPage() {
  const { user, loading, configured, signIn, signUp, signInWithMagicLink } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return <FullScreenLoader />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  if (!configured) {
    return <SetupRequiredScreen />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) setError(error);
      } else if (mode === "signup") {
        const { error, needsConfirmation } = await signUp(email, password);
        if (error) setError(error);
        else if (needsConfirmation)
          setInfo("Check your email to confirm your account, then sign in.");
      } else if (mode === "magic") {
        const { error } = await signInWithMagicLink(email);
        if (error) setError(error);
        else setInfo("Magic-link sent. Check your inbox.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-background to-muted/30 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.svg" alt="Detail Command" className="h-11 w-11 rounded-xl shadow-soft" />
          <div>
            <p className="text-sm font-semibold tracking-tight">Detail Command</p>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Mobile detailing hub
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" && "Sign in"}
              {mode === "signup" && "Create your account"}
              {mode === "magic" && "Sign in with email"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin" &&
                "Welcome back. Your data syncs across phone, tablet, and desktop."}
              {mode === "signup" &&
                "Free to start — your data lives in your own Supabase project."}
              {mode === "magic" &&
                "We'll email you a one-tap link. No password needed."}
            </p>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
              </div>

              {mode !== "magic" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              {info ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
                  {info}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "signin" && "Sign in"}
                {mode === "signup" && "Create account"}
                {mode === "magic" && "Send magic link"}
              </Button>
            </form>

            <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
              <ModeTab active={mode === "signin"} onClick={() => setMode("signin")}>
                Sign in
              </ModeTab>
              <ModeTab active={mode === "signup"} onClick={() => setMode("signup")}>
                Sign up
              </ModeTab>
              <ModeTab active={mode === "magic"} onClick={() => setMode("magic")}>
                <Mail className="mr-1 inline h-3 w-3" />
                Magic link
              </ModeTab>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your data is private to your account and protected by Supabase Row-Level Security.
        </p>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1.5 font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Loading…</p>
      </div>
    </div>
  );
}

function SetupRequiredScreen() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted/40 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.svg" alt="Detail Command" className="h-11 w-11 rounded-xl shadow-soft" />
          <div>
            <p className="text-sm font-semibold tracking-tight">Detail Command</p>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              First-time setup
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="prose prose-sm max-w-none p-6 text-sm dark:prose-invert">
            <h1 className="text-2xl font-semibold">Connect your Supabase project</h1>
            <p>
              This app uses Supabase for cloud sync and authentication so your data
              follows you across phone, tablet, and desktop. Set it up once:
            </p>
            <ol className="mt-3 space-y-2">
              <li>
                Create a free project at{" "}
                <a href="https://app.supabase.com" target="_blank" rel="noreferrer" className="text-primary underline">
                  app.supabase.com
                </a>
                .
              </li>
              <li>
                Open the project's <strong>SQL editor</strong> and paste in the schema
                from <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/schema.sql</code>.
                Click <strong>Run</strong>.
              </li>
              <li>
                Copy the project's <code className="rounded bg-muted px-1 py-0.5 text-xs">URL</code> and
                <code className="rounded bg-muted px-1 py-0.5 text-xs"> anon</code> key
                from <em>Settings → API</em>.
              </li>
              <li>
                Create a file named <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>{" "}
                in the project root with these two lines:
                <pre className="mt-2 rounded-md bg-muted p-3 text-xs">
{`VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
                </pre>
              </li>
              <li>Restart the dev server with <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run dev</code>.</li>
            </ol>
            <p className="mt-4 text-muted-foreground">
              Your data is private to your account — every table has Row-Level Security policies
              ensuring only the owner can read/write their own records.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
