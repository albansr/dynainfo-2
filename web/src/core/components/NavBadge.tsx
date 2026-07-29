interface NavBadgeProps {
  /** `live` shows a pulsing red "EN VIVO" indicator; `new` a static "NUEVO" chip. */
  type: 'live' | 'new';
  /** `sm` fits the sidebar; `md` is for page headers. */
  size?: 'sm' | 'md';
  /** Override the default text (e.g. brand the live badge in a page header). */
  label?: string;
}

const STYLES: Record<NavBadgeProps['type'], string> = {
  live: 'bg-danger/10 text-danger',
  new: 'bg-primary/10 text-primary',
};

const LABELS: Record<NavBadgeProps['type'], string> = {
  live: 'En vivo',
  new: 'Nuevo',
};

const SIZES: Record<NonNullable<NavBadgeProps['size']>, string> = {
  sm: 'text-[9px] px-1.5 py-0.5 gap-1',
  md: 'text-[11px] px-2 py-1 gap-1.5',
};

/** Small highlight badge for navigation items and page headers. */
export function NavBadge({ type, size = 'sm', label }: NavBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ${STYLES[type]} ${SIZES[size]}`}
    >
      {type === 'live' && (
        <span className={`relative flex ${size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'}`}>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
          <span className="relative inline-flex h-full w-full rounded-full bg-danger" />
        </span>
      )}
      {label ?? LABELS[type]}
    </span>
  );
}
