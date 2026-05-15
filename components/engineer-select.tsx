"use client"

import { useState } from "react"
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
import { useUsers } from "@/lib/data/hooks"

export function EngineerSelect({
  value,
  onValueChange,
  placeholder = "Select engineer",
  className,
}: {
  value: string
  onValueChange: (id: string, name: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const { data: users = [], loading } = useUsers()

  const engineers = users.filter(
    (u) =>
      u.role === "engineer" &&
      (!search.trim() ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.id.toLowerCase().includes(search.toLowerCase()))
  )

  const selectedUser = users.find((u) => u.id === value)
  const displayLabel = selectedUser ? `${selectedUser.name} (${selectedUser.id})` : null

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
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or ID..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>{loading ? "Loading…" : "No engineer found."}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onValueChange("", "")
                  setOpen(false)
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                — None —
              </CommandItem>
              {engineers.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.id}
                  onSelect={() => {
                    onValueChange(u.id, u.name)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === u.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {u.name}
                    <span className="ml-1 text-xs text-muted-foreground">({u.id})</span>
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
