/**
 * Reviews Due — small dashboard widget that lists recently completed jobs
 * that haven't had a Google review request sent yet, with a quick-send
 * button. Shows nothing if there's nothing to do, so it stays out of the
 * way when there's no work.
 */
import { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { Star, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/store";
import type { Appointment } from "@/lib/types";
import { formatBusinessMonthDay } from "@/lib/datetime";
import { ReviewRequestPrompt } from "./ReviewRequestPrompt";

const REVIEW_WINDOW_HOURS = 14 * 24; // surface jobs from the last 2 weeks

export function ReviewsDueWidget() {
  const { data } = useStore();
  const enabled = data.settings.reviewRequestEnabled !== false;
  const [target, setTarget] = useState<Appointment | null>(null);

  const due = useMemo(() => {
    if (!enabled) return [];
    const now = Date.now();
    return data.appointments
      .filter((a) => a.status === "completed")
      .filter((a) => !a.reviewRequestSent)
      .filter((a) => {
        const t = parseISO(a.start).getTime();
        const hours = (now - t) / (1000 * 60 * 60);
        return hours >= 0 && hours <= REVIEW_WINDOW_HOURS;
      })
      .sort((a, b) => b.start.localeCompare(a.start))
      .slice(0, 5);
  }, [data.appointments, enabled]);

  if (!enabled || due.length === 0) return null;

  const targetCustomer = target
    ? data.customers.find((c) => c.id === target.customerId)
    : undefined;

  return (
    <>
      <Card className="border-amber-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-amber-500" />
            Reviews due
            <span className="ml-auto rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {due.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {due.map((appt) => {
            const customer = data.customers.find((c) => c.id === appt.customerId);
            return (
              <div
                key={appt.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {customer?.name ?? "Customer"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Completed {formatBusinessMonthDay(appt.start)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTarget(appt)}
                  className="shrink-0"
                >
                  Send <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
      {target ? (
        <ReviewRequestPrompt
          open={true}
          appointment={target}
          customer={targetCustomer}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </>
  );
}
