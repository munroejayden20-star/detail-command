/**
 * IrisLauncher — top-bar entry point. Small animated orb icon with a
 * pulse when there are critical attention items. Routes to /iris.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/store/store";
import { runAttentionRules, countByPriority } from "@/lib/intelligence";
import { IrisOrb } from "./IrisOrb";
import { cn } from "@/lib/utils";

interface IrisLauncherProps {
  className?: string;
}

export function IrisLauncher({ className }: IrisLauncherProps) {
  const { data } = useStore();

  const counts = useMemo(() => {
    const items = runAttentionRules(data, new Date());
    return countByPriority(items);
  }, [data]);

  const critical = counts.critical;
  const high = counts.high;
  const orbState = critical > 0 ? "alert" : high > 0 ? "thinking" : "idle";

  return (
    <Link
      to="/iris"
      aria-label="Open Iris"
      title={
        critical > 0
          ? `Iris — ${critical} critical, ${high} high`
          : high > 0
            ? `Iris — ${high} need attention`
            : "Iris — open intelligence layer"
      }
      className={cn(
        "relative inline-flex h-9 items-center gap-2 rounded-md px-2",
        "text-foreground/80 hover:text-foreground hover:bg-hover",
        "transition-colors duration-fast",
        className,
      )}
    >
      <IrisOrb size="sm" state={orbState} noHalo />
      <span className="hidden md:inline text-xs font-semibold tracking-tight">
        Iris
      </span>
      {critical + high > 0 ? (
        <span
          className={cn(
            "ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1",
            "text-[10px] font-semibold tabular-nums",
            critical > 0
              ? "bg-rose-500 text-white"
              : "bg-amber-500 text-white",
          )}
        >
          {critical + high}
        </span>
      ) : null}
    </Link>
  );
}
