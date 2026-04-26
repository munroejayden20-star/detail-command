import { JobStatus, JOB_STATUSES } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusPillProps {
  status: JobStatus;
  className?: string;
  size?: "sm" | "md";
}

export function StatusPill({ status, className, size = "md" }: StatusPillProps) {
  const def = JOB_STATUSES.find((s) => s.value === status)!;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        def.tone,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          `status-bar-${status.replace("_", "-")}`
        )}
      />
      {def.label}
    </span>
  );
}
