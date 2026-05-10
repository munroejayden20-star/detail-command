import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, onCheckedChange, className, id, disabled }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        id={id}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded border ring-focus",
          "transition-[background-color,border-color] duration-fast",
          "disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-background hover:border-primary/50",
          className
        )}
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </button>
    );
  }
);
Checkbox.displayName = "Checkbox";
