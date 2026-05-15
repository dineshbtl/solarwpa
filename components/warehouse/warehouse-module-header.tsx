"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export type WarehouseModuleHeaderProps = {
  title: string
  description: string
  icon: LucideIcon
  /** Primary / secondary controls on the right (filters, CTAs, etc.) */
  actions?: ReactNode
}

export function WarehouseModuleHeader({ title, description, icon: Icon, actions }: WarehouseModuleHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link href="/warehouse">
          <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Warehouse
          </Button>
        </Link>
        <span className="shrink-0 text-muted-foreground">/</span>
        <div className="flex min-w-0 items-center gap-2">
          <div className="shrink-0 rounded-lg bg-gradient-dark-green p-1.5">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </div>
  )
}
