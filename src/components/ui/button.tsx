import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // `kaushal-button*` classes carry the shared size, radius, and motion rules in globals.css;
  // unlayered CSS wins over the Tailwind utilities here, so sizes stay consistent everywhere.
  "kaushal-button inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "kaushal-button-primary border border-primary bg-primary text-primary-foreground shadow-sm shadow-black/5 hover:bg-primary-hover",
        primary:
          "kaushal-button-primary border border-primary bg-primary text-primary-foreground shadow-sm shadow-black/5 hover:bg-primary-hover",
        destructive:
          "kaushal-button-danger border border-destructive bg-background text-destructive shadow-sm shadow-black/5 hover:bg-destructive/10",
        danger:
          "kaushal-button-danger border border-destructive bg-background text-destructive shadow-sm shadow-black/5 hover:bg-destructive/10",
        outline:
          "kaushal-button-secondary border border-input bg-background shadow-sm shadow-black/5 hover:border-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "kaushal-button-secondary border border-input bg-background shadow-sm shadow-black/5 hover:border-foreground hover:bg-accent hover:text-accent-foreground",
        dark: "kaushal-button-dark border border-foreground bg-foreground text-background shadow-sm shadow-black/5 hover:bg-panel-soft",
        light: "kaushal-button-light border border-background bg-background text-foreground shadow-sm shadow-black/5",
        ghost: "kaushal-button-ghost text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        link: "kaushal-button-link text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "kaushal-button--md h-9 px-4 py-2",
        sm: "kaushal-button--sm h-8 rounded-lg px-3 text-xs",
        lg: "kaushal-button--lg h-10 rounded-lg px-8",
        icon: "kaushal-button--icon h-9 w-9",
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
