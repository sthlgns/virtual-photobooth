"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { motion } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps
  extends Omit
    ButtonHTMLAttributes<HTMLButtonElement>,
    "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration" | "onDrag" | "onDragStart" | "onDragEnd"
  > {
  variant?: Variant;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-flash text-ink font-semibold shadow-glow hover:bg-flash/90 focus-visible:ring-flash",
  secondary:
    "bg-curtain text-ink font-semibold hover:bg-curtain-soft focus-visible:ring-curtain",
  ghost:
    "bg-surface/5 text-paper border border-surface/15 hover:bg-surface/10 focus-visible:ring-surface/40",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", isLoading, className = "", children, disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled ? 1 : 1.03 }}
        whileTap={{ scale: disabled ? 1 : 0.97 }}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-base transition-colors duration-200 outline-none focus-visible:ring-2 ring-offset-2 ring-offset-canvas disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
