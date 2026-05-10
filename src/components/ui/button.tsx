import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap gap-2",
    "rounded-md text-sm font-medium tracking-tight",
    "ring-focus disabled:pointer-events-none disabled:opacity-50",
    "transition-[transform,background-color,border-color,box-shadow,color] duration-fast ease-snappy",
    "active:scale-[0.97]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground shadow-soft",
          "hover:bg-primary/92 hover:shadow-md",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground shadow-soft",
          "hover:bg-destructive/92 hover:shadow-md",
        ].join(" "),
        outline: [
          "border border-border bg-card text-foreground",
          "hover:bg-hover hover:border-foreground/20",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-accent",
        ].join(" "),
        ghost: "text-foreground hover:bg-accent hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
        soft: [
          "bg-primary/10 text-primary border border-primary/15",
          "hover:bg-primary/15 hover:border-primary/25",
        ].join(" "),
        success: [
          "bg-success text-success-foreground shadow-soft",
          "hover:bg-success/92 hover:shadow-md",
        ].join(" "),
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6",
        xl: "h-12 rounded-md px-7 text-[15px]",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
