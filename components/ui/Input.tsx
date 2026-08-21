import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus-visible:border-accent ${className}`}
        {...props}
      />
    );
  },
);
