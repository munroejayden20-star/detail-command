import { useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "./AuthProvider";

export function AccessDeniedPage() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      window.location.href = "/book";
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-background to-muted/30 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Access restricted
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This dashboard is private and only available to authorized
              administrators.
            </p>
            {user?.email ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Signed in as <span className="font-medium">{user.email}</span>
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-2">
              <Button asChild className="w-full">
                <a href="/book">Return to booking page</a>
              </Button>
              {user ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onSignOut}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Sign out
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
