interface Option {
  value: string;
  label: string;
}

export default function CustomSelect({
  options,
  value,
  onChange,
}: {
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className="group relative shrink-0 flex h-[34px] min-w-[88px] items-center gap-1.5 bg-elevated/90 border border-line rounded-md pl-2.5 pr-7 py-1.5 text-[13px] text-fg-secondary text-left whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 hover:bg-hover hover:text-fg hover:border-line-strong active:scale-[0.985] active:bg-selected"
    >
      <span className="truncate">{current.label}</span>
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-tertiary transition-colors group-hover:text-fg-secondary"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}
