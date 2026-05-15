"use client"

import { cn } from "@/lib/utils"

type MaterialTypeListProps = {
  value: string
  onChange: (name: string) => void
  options: readonly string[]
  /** Tighter rows for inline / table cells */
  dense?: boolean
  className?: string
  /** When true, show legacy values not in the preset list (e.g. old "Inverter 5kW" rows) */
  extraOptions?: string[]
  /** How many lines already use this material type (shows “Added n” badge) */
  countsByType?: Record<string, number>
}

/**
 * Survey-style vertical list: tap a row to select material type (no dropdown).
 */
export function MaterialTypeList({
  value,
  onChange,
  options,
  dense = false,
  className,
  extraOptions = [],
  countsByType,
}: MaterialTypeListProps) {
  const preset = options as readonly string[]
  const extras = extraOptions.filter((x) => x && !preset.includes(x))
  const merged = [...options, ...extras]

  return (
    <div
      role="listbox"
      aria-label="Material type"
      className={cn(
        "flex max-h-[min(50vh,22rem)] flex-col gap-1.5 overflow-y-auto rounded-lg border border-solar bg-background p-2 shadow-sm",
        dense && "max-h-36 gap-1 p-1.5",
        className
      )}
    >
      {merged.map((opt) => {
        const addedCount = countsByType?.[opt] ?? 0
        return (
          <button
            key={opt}
            type="button"
            role="option"
            aria-selected={value === opt}
            onClick={() => onChange(opt)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md border text-left font-medium transition-colors",
              dense ? "px-2 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
              value === opt
                ? "border-solar-dark bg-solar-dark text-white shadow-sm"
                : "border-transparent bg-muted/50 text-foreground hover:bg-muted"
            )}
          >
            <span className="min-w-0 flex-1">{opt}</span>
            {addedCount > 0 && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  value === opt ? "bg-white/25 text-white" : "bg-solar-dark/15 text-solar-dark"
                )}
              >
                Added {addedCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
