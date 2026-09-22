import { HTMLAttributes } from "react";

export function GlassPanel({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-3xl border border-surface/10 bg-canvas-soft/95 backdrop-blur-glass shadow-glass ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
