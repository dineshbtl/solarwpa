"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type WorkflowSummarySectionProps = {
  surveyorName: string
  surveySubmitDate: string
  approvedByName: string
  approvedDate: string
  installerName: string
  installationDate: string
  inspectorName: string
  inspectionDate: string
}

const empty = "—"

export function WorkflowSummarySection({
  surveyorName = empty,
  surveySubmitDate = empty,
  approvedByName = empty,
  approvedDate = empty,
  installerName = empty,
  installationDate = empty,
  inspectorName = empty,
  inspectionDate = empty,
}: WorkflowSummarySectionProps) {
  const rows = [
    { label: "Surveyor name", value: surveyorName, sub: "Survey submit date", subValue: surveySubmitDate },
    { label: "Approved by name", value: approvedByName, sub: "Approved date", subValue: approvedDate },
    { label: "Installer name", value: installerName, sub: "Installation date", subValue: installationDate },
    { label: "Inspector name", value: inspectorName, sub: "Inspection date", subValue: inspectionDate },
  ]

  return (
    <Card className="border-solar bg-solar-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg text-solar-dark">Workflow Summary</CardTitle>
        <p className="text-sm text-muted-foreground">
          Surveyor, approval, installer and inspection details — same section on survey, installation and inspection pages
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-1 rounded-lg border border-solar bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</p>
                <p className="mt-0.5 text-sm font-medium text-solar-dark">{row.value}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.sub}</p>
                <p className="mt-0.5 text-sm text-solar-dark">{row.subValue}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
