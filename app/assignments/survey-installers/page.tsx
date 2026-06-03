"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { useSurveysPaginated, useUsers } from "@/lib/data/hooks"
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"
import * as surveysData from "@/lib/data/surveys"
import { buildAuthHeaders } from "@/lib/data/auth-headers"
import {
  SURVEYS_INSTALLATION_FILTER_ANY,
  SURVEYS_INSTALLATION_FILTER_NONE,
  SURVEYS_INSTALLER_FILTER_UNASSIGNED,
} from "@/lib/supabase/surveys"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { toast } from "@/hooks/use-toast"
import { useRole } from "@/contexts/role-context"
import { hasPermissionFromMap } from "@/lib/rbac"
import * as XLSX from "xlsx"

const SEARCH_DEBOUNCE_MS = 300
const INSTALLER_NONE = "__none__"

type AssignmentRow = {
  id: string
  serviceNo: string
  beneficiary: string
  mobile: string
  installerId?: string
  installationId?: string
  installationStatus?: string
  installationStatusLabel: string
  assignable: boolean
}

export default function SurveyInstallerAssignmentsPage() {
  // useSearchParams() requires a Suspense boundary in Next.js 16+ during
  // static prerender, even on a "use client" page.
  return (
    <Suspense fallback={null}>
      <SurveyInstallerAssignmentsPageInner />
    </Suspense>
  )
}

function SurveyInstallerAssignmentsPageInner() {
  const {
    data: surveys,
    total,
    loading,
    error,
    page,
    pageSize,
    setPage,
    setSearch: setSearchApi,
    refetch,
    installerFilter,
    setInstallerFilter,
    installationStatusFilter,
    setInstallationStatusFilter,
  } = useSurveysPaginated({ pageSize: 15, listSource: "assignment" })
  const { data: users = [] } = useUsers()
  const [searchQuery, setSearchQuery] = useState("")
  const [savingSurveyId, setSavingSurveyId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkInstaller, setBulkInstaller] = useState(INSTALLER_NONE)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)

// -------------------------------------------------------
// Helper: download CSV template
const downloadTemplate = () => {
  const headers = ["installerId", "surveyId", "serviceNo"]
  const csv = headers.join(",") + "\n"
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", "installer_assignment_template.csv")
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Helper: download installer IDs list
const downloadInstallerList = () => {
  const headers = ["Name", "Email", "installerId"]
  const rows = installers.map((u) => [
    `"${(u.name || "").replace(/"/g, '""')}"`,
    `"${(u.email || "").replace(/"/g, '""')}"`,
    u.id,
  ])
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", "installer_ids_list.csv")
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}


// Helper: parse CSV/Excel and bulk assign
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  let rows: { installerId?: string; surveyId?: string }[] = []

  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data, { type: "array" })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json(ws) as any
  } else {
    const text = await file.text()
    const lines = text.trim().split("\n")
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const installerIdx = header.indexOf("installerid")
    const surveyIdx = header.indexOf("surveyid")
    const serviceNoIdx = header.indexOf("serviceno")
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",")
      rows.push({
        installerId: installerIdx >= 0 ? cols[installerIdx]?.trim() : undefined,
        surveyId: surveyIdx >= 0 ? cols[surveyIdx]?.trim() : undefined,
        // Also capture serviceNo if present
        ...(serviceNoIdx >= 0 && { serviceNo: cols[serviceNoIdx]?.trim() })
      })
    }
  }

  setBulkSaving(true)
  setBulkSaving(true)
  
  // 1. Normalize all rows to ensure headers are matched correctly regardless of formatting
  const normalizedRows = rows.map((r: any) => {
    const normalized: Record<string, string> = {}
    for (const key of Object.keys(r)) {
      if (r[key] !== undefined && r[key] !== null) {
        const cleanKey = key.toLowerCase().replace(/[\s_.]+/g, "")
        normalized[cleanKey] = String(r[key]).trim()
      }
    }
    return {
      installerId: normalized["installerid"] || r.installerId,
      surveyId: normalized["surveyid"] || r.surveyId,
      serviceNo: normalized["serviceno"]
    }
  })

  // 2. Identify missing survey IDs that have a service number
  const missingSurveyIdRows = normalizedRows.filter(r => !r.surveyId && r.serviceNo)
  const serviceNosToResolve = Array.from(new Set(missingSurveyIdRows.map(r => r.serviceNo)))

  let serviceNoToIdMap: Record<string, string> = {}

  // 3. Batch resolve service numbers directly from Supabase
  if (serviceNosToResolve.length > 0) {
    try {
      const supabase = getSupabaseBrowserClient()
      
      // Batch into chunks of 100 to avoid overly large queries
      const chunkSize = 100
      for (let i = 0; i < serviceNosToResolve.length; i += chunkSize) {
        const chunk = serviceNosToResolve.slice(i, i + chunkSize)
        
        // Use a lightweight, targeted query specifically for ID resolution
        const { data, error } = await supabase
          .from("surveys")
          .select("id, service_no")
          .eq("project_id", ACTIVE_PROJECT_ID)
          .in("service_no", chunk)
        
        if (!error && data) {
          for (const row of data) {
            if (row.service_no) {
              // Map both exact and lowercase versions for robust lookup
              serviceNoToIdMap[row.service_no] = row.id
              serviceNoToIdMap[row.service_no.trim().toLowerCase()] = row.id
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to resolve service numbers via Supabase batch fetch", e)
    }
  }

  // 4. Apply resolved IDs and filter to final valid rows
  const resolvedRows = normalizedRows.map((r) => {
    let finalSurveyId = r.surveyId
    if (!finalSurveyId && r.serviceNo) {
      finalSurveyId = serviceNoToIdMap[r.serviceNo] || serviceNoToIdMap[r.serviceNo.trim().toLowerCase()]
    }
    return { ...r, surveyId: finalSurveyId }
  })

  const valid = resolvedRows.filter((r) => r.installerId && r.surveyId)
  if (valid.length === 0) {
    toast({ title: "No valid rows", description: "The file does not contain any valid installer/survey combinations. Ensure you have either surveyId or a matching serviceNo.", variant: "destructive" })
    setBulkSaving(false)
    return
  }

  try {
    const authHeaders = await buildAuthHeaders()
    setImportProgress({ current: 0, total: valid.length })
    
    let failCount = 0
    for (let i = 0; i < valid.length; i++) {
      const r = valid[i]
      
      // Direct POST to the live API, completely bypassing the local offline outbox
      const res = await fetch("/api/surveys/installer", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ surveyId: r.surveyId, installerId: r.installerId })
      })

      if (!res.ok) {
        failCount++
      }

      setImportProgress({ current: i + 1, total: valid.length })
      // Yield occasionally to update the UI counter smoothly
      if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0))
    }
    
    await refetch()
    const skipped = rows.length - valid.length
    const skipMsg = skipped > 0 ? ` (${skipped} skipped due to unmatched IDs)` : ""
    const failMsg = failCount > 0 ? ` (${failCount} failed to sync to live DB)` : ""
    toast({ title: "Import complete", description: `${valid.length - failCount} assignments directly live-synced.${skipMsg}${failMsg}` })
    setSelectedIds(new Set())
  } catch (e) {
    toast({ title: "Import error", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" })
  } finally {
    setBulkSaving(false)
    setImportProgress(null)
  }
}

  const { role, permissionMap } = useRole()
  const canAssign = hasPermissionFromMap(role, "assign_staff", permissionMap)

  // Seed installation_status filter from a deep-link query param (used by the
  // KPI tiles on /installations). Only runs once on mount so the user can
  // change the dropdown afterwards without being snapped back.
  const searchParams = useSearchParams()
  const seededFromQueryRef = useRef(false)
  useEffect(() => {
    if (seededFromQueryRef.current) return
    const raw = searchParams?.get("installation_status")?.trim() ?? ""
    if (!raw) return
    seededFromQueryRef.current = true
    setInstallationStatusFilter(raw)
  }, [searchParams, setInstallationStatusFilter])

  useEffect(() => {
    const t = setTimeout(() => setSearchApi(searchQuery), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchQuery, setSearchApi])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [page, searchQuery, installerFilter, installationStatusFilter])

  const installers = useMemo(
    () => users.filter((u) => u.role === "installer" && (u.status ?? "active") === "active"),
    [users],
  )

  const installerOptions = useMemo(() => {
    const opts = installers.map((u) => ({
      value: u.id,
      label: `${u.name} (${u.email})`,
    }))
    return [{ value: INSTALLER_NONE, label: "Unassigned" }, ...opts]
  }, [installers])

  const tableInstallerFilterOptions = useMemo(() => {
    const fromUsers = installers.map((u) => ({
      value: u.id,
      label: `${u.name} (${u.email})`,
    }))
    return [
      { value: "", label: "All installers" },
      { value: SURVEYS_INSTALLER_FILTER_UNASSIGNED, label: "Households — unassigned only" },
      ...fromUsers,
    ]
  }, [installers])

  const installationStatusFilterOptions = useMemo(
    () => [
      { value: "", label: "All installation statuses" },
      { value: SURVEYS_INSTALLATION_FILTER_ANY, label: "Installation started" },
      { value: SURVEYS_INSTALLATION_FILTER_NONE, label: "Not started yet" },
      { value: "pending", label: "Pending" },
      { value: "in_progress", label: "In progress" },
      { value: "completed", label: "Completed" },
      { value: "inspection_pending", label: "Inspection pending" },
    ],
    [],
  )

  const rows: AssignmentRow[] = useMemo(() => {
    return surveys
      .filter((s) => s.projectId === ACTIVE_PROJECT_ID)
      .map((s) => {
        const installationStatus = s.installationStatus
        const installationStatusLabel = installationStatus
          ? installationStatus.replace(/_/g, " ")
          : "Not started"
        const assignable = s.status !== "completed" && installationStatus !== "completed"
        return {
          id: s.id,
          serviceNo: s.serviceNo,
          beneficiary: s.beneficiaryName,
          mobile: s.mobile?.trim() || "—",
          installerId: s.installerId ?? undefined,
          installationId: s.installationId,
          installationStatus,
          installationStatusLabel,
          assignable,
        }
      })
  }, [surveys])

  const downloadSurveysList = () => {
    const headers = ["Survey ID", "Service No", "Beneficiary", "Mobile", "Installation Status"]
    const csvRows = rows.map((r) => [
      r.id,
      `"${(r.serviceNo || "").replace(/"/g, '""')}"`,
      `"${(r.beneficiary || "").replace(/"/g, '""')}"`,
      `"${(r.mobile || "").replace(/"/g, '""')}"`,
      r.installationStatusLabel || "Not started",
    ])
    const csv = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "surveys_list.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const showInitialSkeleton = loading && surveys.length === 0
  const showRefreshing = loading && surveys.length > 0

  const assignablePageIds = useMemo(() => rows.filter((r) => r.assignable).map((r) => r.id), [rows])
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows])

  const allPageSelected =
    assignablePageIds.length > 0 && assignablePageIds.every((id) => selectedIds.has(id))
  const somePageSelected = assignablePageIds.some((id) => selectedIds.has(id))

  const toggleSelectAllPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        assignablePageIds.forEach((id) => next.add(id))
      } else {
        pageIds.forEach((id) => next.delete(id))
      }
      return next
    })
  }

  const toggleRowSelected = (row: AssignmentRow, checked: boolean) => {
    if (checked && !row.assignable) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(row.id)
      else next.delete(row.id)
      return next
    })
  }

  const onInstallerChange = async (surveyId: string, value: string) => {
    if (!canAssign) return
    const nextId = value === INSTALLER_NONE ? undefined : value
    setSavingSurveyId(surveyId)
    try {
      await surveysData.assignSurveyInstaller(surveyId, nextId)
      await refetch()
      toast({ title: "Installer updated", description: "Assignment saved for this household." })
    } catch (e) {
      toast({
        title: "Could not assign installer",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingSurveyId(null)
    }
  }

  const onBulkAssign = async () => {
    if (!canAssign || selectedIds.size === 0) return
    const rowById = new Map(rows.map((r) => [r.id, r]))
    const ids = [...selectedIds].filter((id) => rowById.get(id)?.assignable)
    const skipped = selectedIds.size - ids.length
    if (ids.length === 0) {
      toast({
        title: "Nothing to apply",
        description: "Selected rows are completed or not eligible for installer assignment.",
        variant: "destructive",
      })
      return
    }
    const nextId = bulkInstaller === INSTALLER_NONE ? undefined : bulkInstaller
    setBulkSaving(true)
    try {
      for (const id of ids) {
        await surveysData.assignSurveyInstaller(id, nextId)
      }
      await refetch()
      setSelectedIds(new Set())
      const skipNote =
        skipped > 0 ? ` ${skipped} completed or ineligible row${skipped === 1 ? "" : "s"} skipped.` : ""
      toast({
        title: "Installer updated",
        description: `Assignment saved for ${ids.length} household${ids.length === 1 ? "" : "s"}.${skipNote}`,
      })
    } catch (e) {
      toast({
        title: "Could not assign installer",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setBulkSaving(false)
    }
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <Button variant="ghost" asChild className="text-foreground hover:bg-accent -ml-2 mb-4">
          <Link href="/assignments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assignments
          </Link>
        </Button>
        <h1 className="text-3xl font-bold text-foreground">Survey → installer</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Search households (beneficiary, service number, mobile, ID), select one or more rows, then assign an
          installer in bulk or per row—same as on the survey detail page, without leaving this screen.
        </p>
        {!canAssign ? (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
            Your role does not include staff assignment. Open a survey read-only or ask an administrator for the
            &quot;Assign staff&quot; permission.
          </p>
        ) : null}
      </div>

      <Card className="border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg inline-flex items-center gap-2">
            Households ({total})
            {showRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing list" />
            ) : null}
          </CardTitle>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative max-w-md flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by service number, mobile, beneficiary name, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-border bg-background pl-9 rounded-lg"
              />
            </div>
            <div className="min-w-[min(100%,260px)] sm:min-w-[240px] flex-1 sm:max-w-sm">
              <SearchableSelect
                options={tableInstallerFilterOptions}
                value={installerFilter}
                onValueChange={setInstallerFilter}
                placeholder="Filter by installer…"
                searchPlaceholder="Search installers…"
                triggerClassName="min-h-9 w-full text-sm"
              />
            </div>
            <div className="min-w-[min(100%,260px)] sm:min-w-[240px] flex-1 sm:max-w-sm">
              <SearchableSelect
                options={installationStatusFilterOptions}
                value={installationStatusFilter}
                onValueChange={setInstallationStatusFilter}
                placeholder="Filter by installation status…"
                searchPlaceholder="Search status…"
                triggerClassName="min-h-9 w-full text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="py-8 text-center text-sm text-destructive">
              Could not load households.
              {error.message ? ` ${error.message}` : " Check your connection and permissions, then refresh."}
            </p>
          ) : showInitialSkeleton ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              {canAssign ? (
                <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  {selectedIds.size > 0 ? (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        {selectedIds.size} household{selectedIds.size === 1 ? "" : "s"} selected
                      </p>
                      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                        <SearchableSelect
                          options={installerOptions}
                          value={bulkInstaller}
                          onValueChange={setBulkInstaller}
                          disabled={bulkSaving}
                          placeholder={bulkSaving ? "Saving…" : "Installer for selected…"}
                          searchPlaceholder="Search by name or email…"
                          triggerClassName="min-h-9 w-full min-w-[220px] text-sm sm:max-w-md"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-lg"
                            disabled={bulkSaving}
                            onClick={() => void onBulkAssign()}
                          >
                            {bulkSaving ? "Applying…" : "Apply to selected"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            disabled={bulkSaving}
                            onClick={() => setSelectedIds(new Set())}
                          >
                            Clear selection
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1" /> // Spacer when nothing selected
                  )}

                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={bulkSaving}
                      onClick={downloadSurveysList}
                    >
                      Download surveys
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={bulkSaving}
                      onClick={downloadInstallerList}
                    >
                      Download installers
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={bulkSaving}
                      onClick={downloadTemplate}
                    >
                      Download template
                    </Button>

                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      id="import-file"
                      onChange={handleFileUpload}
                      disabled={bulkSaving}
                    />
                    <label htmlFor="import-file">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        disabled={bulkSaving}
                        asChild
                      >
                        <span>{importProgress ? `Processing ${importProgress.current} / ${importProgress.total}...` : "Import assignments"}</span>
                      </Button>
                    </label>
                  </div>
                </div>
              ) : null}

              <div className={`overflow-x-auto ${showRefreshing ? "opacity-90" : ""}`} aria-busy={showRefreshing}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canAssign ? (
                        <TableHead className="w-[48px]">
                          <Checkbox
                            checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                            onCheckedChange={(v) => toggleSelectAllPage(v === true)}
                            disabled={bulkSaving || assignablePageIds.length === 0}
                            aria-label="Select all assignable households on this page"
                          />
                        </TableHead>
                      ) : null}
                      <TableHead>Survey</TableHead>
                      <TableHead>Service no.</TableHead>
                      <TableHead>Beneficiary</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Installation status</TableHead>
                      <TableHead className="min-w-[240px]">Assign installer</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const installerDisabled = !canAssign || savingSurveyId === row.id || !row.assignable
                      return (
                        <TableRow key={row.id}>
                          {canAssign ? (
                            <TableCell className="align-middle">
                              <Checkbox
                                checked={selectedIds.has(row.id)}
                                onCheckedChange={(v) => toggleRowSelected(row, v === true)}
                                disabled={bulkSaving || !row.assignable}
                                aria-label={`Select ${row.id}`}
                              />
                            </TableCell>
                          ) : null}
                          <TableCell className="font-mono text-sm">{row.id}</TableCell>
                          <TableCell>{row.serviceNo || "—"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{row.beneficiary || "—"}</TableCell>
                          <TableCell className="tabular-nums text-sm">{row.mobile}</TableCell>
                          <TableCell className="capitalize">{row.installationStatusLabel}</TableCell>
                          <TableCell>
                            <SearchableSelect
                              options={installerOptions}
                              value={row.installerId ?? INSTALLER_NONE}
                              onValueChange={(v) => void onInstallerChange(row.id, v)}
                              disabled={installerDisabled}
                              placeholder={
                                savingSurveyId === row.id
                                  ? "Saving…"
                                  : !row.assignable
                                    ? "Assignment closed"
                                    : canAssign
                                      ? "Search installers…"
                                      : "No assignment permission"
                              }
                              searchPlaceholder="Search by name or email…"
                              triggerClassName="min-h-9 text-sm"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {row.installationId ? (
                              <Button variant="outline" size="sm" asChild className="rounded-lg">
                                <Link href={`/installation-details?id=${row.installationId}`}>Installation details</Link>
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" asChild className="rounded-lg">
                                <Link href={`/installations/new?surveyId=${encodeURIComponent(row.id)}`}>
                                  Start installation
                                </Link>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={canAssign ? 8 : 7}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          No households in this project scope. Try another search or filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-medium">{total === 0 ? 0 : (page - 1) * pageSize + 1}</span>–
                  <span className="font-medium">{Math.min(page * pageSize, total)}</span> of{" "}
                  <span className="font-medium">{total}</span>
                  {total > 0 ? (
                    <span className="ml-2">
                      (page {page} of {totalPages})
                    </span>
                  ) : null}
                </p>
                {total > 0 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={page <= 1}
                      onClick={() => setPage(Math.max(1, page - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={page >= totalPages}
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
