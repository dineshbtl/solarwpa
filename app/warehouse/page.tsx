"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Truck, Undo2, BarChart3, Building2, Inbox, Repeat2, ScrollText, ClipboardList, PackageSearch, Wrench } from "lucide-react"
import Link from "next/link"
import { getProjectUtilizationQuick } from "@/lib/supabase/warehouse"

const NAV_CARDS = [
  {
    title: "GRN · Material inward",
    description: "Goods receipt against PO (stock inward); capture serials (optional wedge scans in the same field)",
    icon: Inbox,
    href: "/warehouse/inward",
    color: "bg-emerald-600",
  },
  {
    title: "DC · Material dispatch",
    description: "Delivery challan / outward movement — optional source & destination warehouses",
    icon: Truck,
    href: "/warehouse/dispatch",
    color: "bg-blue-600",
  },
  {
    title: "Field returns",
    description: "Unused or damaged material from villages back to district warehouse (not supplier RMA)",
    icon: Undo2,
    href: "/warehouse/returns",
    color: "bg-rose-600",
  },
  {
    title: "Supplier RMA",
    description: "Vendor returns — defective units shipped back to supplier with PO reference",
    icon: PackageSearch,
    href: "/warehouse/supplier-returns",
    color: "bg-amber-600",
  },
  {
    title: "Stock ledger",
    description: "Chronological movement audit (GRN, DC, village issue, returns, RMA)",
    icon: ScrollText,
    href: "/warehouse/stock-ledger",
    color: "bg-sky-600",
  },
  {
    title: "Stock report",
    description: "Per-warehouse quantity balances from movements",
    icon: ClipboardList,
    href: "/warehouse/stock-report",
    color: "bg-teal-600",
  },
  {
    title: "Maintenance spares",
    description: "O&M truck / spares pool (WH-MNT-001) guidance",
    icon: Wrench,
    href: "/warehouse/maintenance",
    color: "bg-slate-600",
  },
  {
    title: "House Reallocation",
    description: "Move serial-tracked materials between households with audit trail",
    icon: Repeat2,
    href: "/warehouse/reallocation",
    color: "bg-indigo-600",
  },
  {
    title: "Material Master",
    description: "Required vs GRN vs DC vs issued vs returns — clarified pipeline columns",
    icon: BarChart3,
    href: "/warehouse/materials",
    color: "bg-violet-600",
  },
]

export default function WarehousePage() {
  const [util, setUtil] = useState<{
    totalApproved: number
    householdsIssued: number
    householdsPending: number
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    getProjectUtilizationQuick()
      .then((u) => {
        if (!cancelled) setUtil(u)
      })
      .catch(() => {
        if (!cancelled)
          setUtil({ totalApproved: 8929, householdsIssued: 0, householdsPending: 8929 })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const totalApproved = util?.totalApproved ?? 8929
  const householdsIssuedDisplay = util ? util.householdsIssued.toLocaleString() : "…"
  const householdsPendingDisplay = util ? util.householdsPending.toLocaleString() : "…"

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="rounded-lg bg-gradient-dark-green p-2">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Warehouse &amp; Material Tracking</h1>
        </div>
        <p className="mt-1 text-muted-foreground ml-1">
          GRN inward, DC dispatch, village issues, field returns, supplier RMA, and stock reporting
        </p>
      </div>

      <Card className="mb-10 border-border bg-muted/30 shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Terminology</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <p>
            <strong className="text-foreground">GRN / inward</strong> — receipt against PO into a warehouse (goods inward).
          </p>
          <p>
            <strong className="text-foreground">DC / dispatch</strong> — outward delivery challan between warehouses or to the field.
          </p>
          <p>
            <strong className="text-foreground">Field return</strong> — material coming back from a village/site to your warehouse.
          </p>
          <p>
            <strong className="text-foreground">Supplier RMA</strong> — units returned to the vendor (credit / replacement), separate from field returns.
          </p>
          <p className="sm:col-span-2">
            <strong className="text-foreground">Maintenance stock</strong> — spare parts / O&amp;M pool (warehouse WH-MNT-001); treat like any other warehouse for inward and dispatch.
          </p>
        </CardContent>
      </Card>

      {/* Nav cards */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {NAV_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href}>
              <Card className="group h-full cursor-pointer rounded-xl border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="flex h-full min-h-[200px] flex-col gap-3 p-5">
                  <div className={`w-fit rounded-lg p-2.5 ${card.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground transition-colors group-hover:text-green-700">
                      {card.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-snug">
                      {card.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-auto w-fit px-0 text-green-700 hover:bg-transparent hover:text-green-800 font-medium"
                    tabIndex={-1}
                  >
                    Open →
                  </Button>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Project Utilization */}
      <Card className="border-border bg-card shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg">Project Utilization</CardTitle>
          <p className="text-sm text-muted-foreground">
            SC &amp; ST PM SURYA GHAR SCHEME &nbsp;|&nbsp; District: Kurnool &nbsp;|&nbsp; 2kW per household &nbsp;|&nbsp; 17.86 MW total
          </p>
        </CardHeader>
        <CardContent>
          {/* Summary banner */}
          <div className="mb-6 rounded-xl bg-gradient-dark-green p-5 text-white shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white/80">Total Households</p>
                <p className="mt-1 text-4xl font-bold tabular-nums">{util ? totalApproved.toLocaleString() : "…"}</p>
                <p className="mt-1 text-xs text-green-100">Approved under PM SURYA GHAR scheme</p>
              </div>
              <div className="rounded-lg bg-white/15 p-2.5 shrink-0">
                <Building2 className="h-7 w-7 text-white" />
              </div>
            </div>
          </div>

          {/* 3 stat chips */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/40 px-5 py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Approved</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">
                {util ? totalApproved.toLocaleString() : "…"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-5 py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Households Issued</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{householdsIssuedDisplay}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-5 py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Households Pending</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{householdsPendingDisplay}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
