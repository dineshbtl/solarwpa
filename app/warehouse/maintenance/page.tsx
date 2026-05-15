import Link from "next/link"
import { ArrowLeft, Wrench } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function MaintenanceStockInfoPage() {
  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <Link href="/warehouse" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Warehouse hub
      </Link>

      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-lg bg-slate-700 p-2 text-white">
          <Wrench className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Maintenance &amp; spares (O&amp;M)</h1>
          <p className="mt-1 text-muted-foreground">
            Service-truck and spare-parts inventory is modeled as a dedicated warehouse location.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl rounded-xl border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Migration <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">00027_inventory_enhancements.sql</code>{" "}
            seeds warehouse <strong className="text-foreground">WH-MNT-001</strong> —{" "}
            <em>Field Maintenance &amp; Spares (O&amp;M)</em>, category <code className="rounded bg-muted px-1 font-mono">maintenance</code>.
          </p>
          <p>
            Record inward receipts and dispatches to/from this warehouse like any other DC. Use the{" "}
            <Link href="/warehouse/stock-report" className="text-green-700 underline underline-offset-2">
              stock report
            </Link>{" "}
            filtered to WH-MNT-001 to view spare balances.
          </p>
          <Button asChild variant="outline" className="mt-2 rounded-lg">
            <Link href="/warehouse/stock-report">Open stock report</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
