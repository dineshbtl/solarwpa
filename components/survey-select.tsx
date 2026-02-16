"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSurveysLazy } from "@/lib/data/hooks"
import type { Survey } from "@/lib/store/surveys"

const SEARCH_DEBOUNCE_MS = 280

export function SurveySelect({
  value,
  onSelect,
  selectedSurvey,
  placeholder = "Select survey",
  className,
}: {
  value: string
  onSelect: (survey: Survey | null) => void
  selectedSurvey?: Survey | null
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null)

  const {
    data: surveys,
    total,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    setSearch: setSearchApi,
  } = useSurveysLazy({ pageSize: 20 })

  const handleSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => setSearchApi(q), SEARCH_DEBOUNCE_MS)
    },
    [setSearchApi]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Load more when sentinel is visible (infinite scroll)
  useEffect(() => {
    if (!open || !hasMore || loadingMore || loading) return
    const el = loadMoreSentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { root: null, rootMargin: "80px", threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [open, hasMore, loadingMore, loading, loadMore])

  const displayLabel = selectedSurvey
    ? `${selectedSurvey.beneficiaryName} · ${selectedSurvey.serviceNo} (${selectedSurvey.id})`
    : value
    ? `ID: ${value}`
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between border-solar bg-background font-normal", className)}
        >
          <span className="truncate">{displayLabel ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search by name, service no..." onValueChange={handleSearch} />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>{loading ? "Loading…" : "No survey found. Type to search."}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onSelect(null)
                  setOpen(false)
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                — None —
              </CommandItem>
              {surveys.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.id}
                  onSelect={() => {
                    onSelect(s)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {s.beneficiaryName} · {s.serviceNo} ({s.id})
                  </span>
                </CommandItem>
              ))}
              {hasMore && (
                <div ref={loadMoreSentinelRef} className="flex justify-center py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={loadingMore}
                    onClick={(e) => {
                      e.preventDefault()
                      loadMore()
                    }}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      `Load more (${surveys.length} of ${total})`
                    )}
                  </Button>
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
