import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-accentInk shadow-soft-inset hover:bg-accent/90 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:bg-accent/50 disabled:shadow-none disabled:translate-y-0 disabled:active:scale-100",
  secondary:
    "bg-surface text-ink border border-border hover:bg-bg hover:border-ink/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100",
  ghost: "bg-transparent text-ink hover:bg-bg active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100",
  danger: "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] disabled:bg-red-300 disabled:active:scale-100",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ className = "", variant = "primary", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
});
