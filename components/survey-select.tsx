"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
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
import { useRole } from "@/contexts/role-context"
import { buildAuthHeaders } from "@/lib/data/auth-headers"
import type { Survey } from "@/lib/store/surveys"

const SEARCH_DEBOUNCE_MS = 280

type SurveyListItem = {
  id: string
  beneficiaryName: string
  serviceNo: string
  aadharNo?: string
  mobile?: string
  status?: Survey["status"]
  district?: string
}

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
  const [surveys, setSurveys] = useState<SurveyListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { role } = useRole()

  const fetchSurveys = useCallback(async (search: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: "20", offset: "0" })
      if (search) params.set("search", search)
      // For installers, use the API that filters by assigned surveys
      if (role === "installer") {
        params.set("forInstaller", "1")
      }
      const headers = await buildAuthHeaders()
      const res = await fetch(`/api/surveys/list?${params.toString()}`, { headers })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : `Request failed (${res.status})`
        throw new Error(msg)
      }
      setSurveys(data.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [role])

  const handleSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchSurveys(q), SEARCH_DEBOUNCE_MS)
    },
    [fetchSurveys]
  )

  useEffect(() => {
    fetchSurveys("")
  }, [fetchSurveys])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

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
          <CommandInput placeholder="Search by name, phone, Aadhaar, service no, consumer no..." onValueChange={handleSearch} />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>
              {loading
                ? "Loading..."
                : error
                ? `Could not load households.${error.message ? ` ${error.message}` : " Check session and permissions."}`
                : "No survey found. Type to search."}
            </CommandEmpty>
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
                    // Map to Survey-like object for onSelect
                    onSelect({
                      id: s.id,
                      beneficiaryName: s.beneficiaryName,
                      serviceNo: s.serviceNo,
                      aadharNo: s.aadharNo ?? "",
                      mobile: s.mobile,
                      status: s.status ?? "pending",
                      siteLocation: {
                        district: s.district ?? "",
                        pinCode: "",
                      },
                    } as Survey)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {s.beneficiaryName} · {s.serviceNo} · {s.mobile ?? "No mobile"} · {s.aadharNo ?? "No Aadhaar"} ({s.id})
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
