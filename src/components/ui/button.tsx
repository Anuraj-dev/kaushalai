import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "kaushal-button inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium leading-none transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "kaushal-button-primary",
        primary: "kaushal-button-primary",
        destructive: "kaushal-button-danger",
        danger: "kaushal-button-danger",
        outline: "kaushal-button-secondary",
        secondary: "kaushal-button-secondary",
        dark: "kaushal-button-dark",
        light: "kaushal-button-light",
        ghost: "kaushal-button-ghost",
        link: "kaushal-button-link",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
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
