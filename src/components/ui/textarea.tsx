import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed",
      "transition-[border-color,box-shadow] duration-fast",
      "placeholder:text-muted-foreground/70",
      "hover:border-border",
      "focus-visible:outline-none focus-visible:border-primary/60 focus-visible:shadow-ring-primary",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
