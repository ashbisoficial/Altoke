const SIZE_CLASSES = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-11 w-11",
};

/* The mark is a torn ticket stub — chamfered corner, a bite out of the
   left edge — echoing the dashed-perforation seam (.ticket-stub) already
   used on issue cards, instead of an arbitrary letter-in-a-box badge. */
export function LogoMark({ size = "md" }: { size?: keyof typeof SIZE_CLASSES }) {
  return (
    <span className={`shadow-soft shrink-0 ${SIZE_CLASSES[size]}`} aria-hidden>
      <svg viewBox="0 0 32 32" className="h-full w-full" fill="none">
        <defs>
          <linearGradient id="altoke-mark-g" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgb(var(--accent))" />
            <stop offset="1" stopColor="rgb(var(--accent3))" />
          </linearGradient>
        </defs>
        <path
          d="M12,4 L22,4 L28,10 L28,22 A6,6 0 0 1 22,28 L10,28 A6,6 0 0 1 4,22 L4,19 A3,3 0 0 0 4,13 L4,10 A6,6 0 0 1 10,4 Z"
          fill="url(#altoke-mark-g)"
        />
        <circle cx="19" cy="16" r="1.6" fill="rgb(var(--accent-ink))" fillOpacity="0.85" />
      </svg>
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
