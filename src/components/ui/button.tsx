import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "button inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-sm)] text-xs font-bold leading-none transition-[transform,box-shadow,background-color,border-color] duration-150 outline-offset-2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--ink)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:transform-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "button-primary",
        primary: "button-primary",
        destructive: "button-danger",
        danger: "button-danger",
        outline: "button-secondary",
        secondary: "button-secondary",
        dark: "button-dark",
        light: "button-light",
        ghost: "border-transparent bg-transparent text-[var(--muted)] hover:text-[var(--ink)]",
        link: "min-h-0 border-0 bg-transparent px-0 py-0 text-[var(--ink)] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-[17px] py-2",
        sm: "min-h-9 rounded-[var(--radius-sm)] px-[13px] text-[11px]",
        lg: "min-h-12 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
