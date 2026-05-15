"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, LayoutGrid, Shield } from "lucide-react"

import { cn } from "@/lib/utils"

const overviewHref = "/settings"
const rolesHref = "/settings/roles"

export function SettingsSidebar() {
  const pathname = usePathname()
  const onOverview = pathname === overviewHref
  const onRoles = pathname === rolesHref || pathname?.startsWith(`${rolesHref}/`)

  return (
    <aside className="shrink-0 border-b border-border bg-muted/30 lg:w-56 lg:border-b-0 lg:border-r lg:bg-card">
      <div className="px-4 py-5 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings</p>
        <nav className="mt-3 space-y-1">
          <Link
            href={overviewHref}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              onOverview ? "bg-green-700 text-white shadow-sm" : "text-foreground hover:bg-muted",
            )}
          >
            <LayoutGrid className="h-4 w-4 shrink-0 opacity-90" />
            Overview
          </Link>
        </nav>

        <p className="mt-8 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Administration
        </p>
        <p className="mt-2 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
          Users & permissions
        </p>
        <nav className="mt-2 space-y-1">
          <Link
            href={rolesHref}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              onRoles ? "bg-green-700 text-white shadow-sm" : "text-foreground hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 shrink-0 opacity-90" />
              Roles
            </span>
            <ChevronRight className={cn("h-4 w-4 shrink-0 opacity-70", onRoles && "text-white")} />
          </Link>
        </nav>
      </div>
    </aside>
  )
}
