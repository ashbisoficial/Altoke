import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink shadow-[inset_0_1px_2px_rgb(0_0_0_/_0.03)] transition-colors placeholder:text-ink/40 focus-visible:border-accent ${className}`}
        {...props}
      />
    );
  },
);
