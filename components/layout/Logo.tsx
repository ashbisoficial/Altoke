const SIZE_CLASSES = {
  sm: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-11 w-11 text-lg",
};

export function LogoMark({ size = "md" }: { size?: keyof typeof SIZE_CLASSES }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-lg font-bold text-white shadow-soft ${SIZE_CLASSES[size]}`}
      style={{ background: "linear-gradient(135deg, var(--accent), var(--accent3))" }}
    >
      A
    </span>
  );
}

export function Logo({ size = "md" }: { size?: keyof typeof SIZE_CLASSES }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className="font-heading text-xl font-semibold">Altoke</span>
    </span>
  );
}
