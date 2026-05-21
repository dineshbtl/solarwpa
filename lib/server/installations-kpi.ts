import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

export type InstallationsKpiPayload = {
  total: number
  pending: number
  inProgress: number
  completed: number
  inspectionPending: number
}

/** Safe fallback when KPI aggregation fails (keeps client list + KPI in sync for installers). */
export const EMPTY_INSTALLATIONS_KPI: InstallationsKpiPayload = {
  total: 0,
  pending: 0,
  inProgress: 0,
  completed: 0,
  inspectionPending: 0,
}

/** Prefer single-query RPC; fall back to four head counts if RPC is unavailable (older DB). */
export async function getInstallationsKpiForProject(
  supabase: SupabaseClient<Database>,
  projectId: string,
  options?: { engineerProfileId?: string; installerAssignedSurveyIds?: string[] }
): Promise<InstallationsKpiPayload> {
  const engineerProfileId = options?.engineerProfileId?.trim()
  const installerAssignedSurveyIds = options?.installerAssignedSurveyIds ?? []

  // Supabase generated types can lag behind migrations; use a narrow runtime-safe cast for RPC/query builders.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // For non-installer users, use the RPC for efficient counting
  if (!engineerProfileId) {
    const rpcTry = await sb.rpc("installation_kpi_counts", { p_project_id: projectId })
    if (!rpcTry.error && rpcTry.data != null && typeof rpcTry.data === "object") {
      const o = rpcTry.data as Record<string, unknown>
      const pending = Number(o.pending ?? 0)
      const inProgress = Number(o.in_progress ?? 0)
      const completed = Number(o.completed ?? 0)
      const inspectionPending = Number(o.inspection_pending ?? 0)
      return {
        total: pending + inProgress + completed + inspectionPending,
        pending,
        inProgress,
        completed,
        inspectionPending,
      }
    }
  }

  // For installers, fetch all matching installation IDs first, then count by status
  // This ensures KPI matches the list (same logic as installer-installations-merge)
  if (engineerProfileId) {
    const requests: Promise<{ data: unknown; error: unknown }>[] = []

    // Query 1: installations where engineer_id = profileId
    requests.push(
      sb.from("installations").select("id, status").eq("project_id", projectId).eq("engineer_id", engineerProfileId)
    )

    // Query 2: installations linked to surveys assigned to this installer
    if (installerAssignedSurveyIds.length > 0) {
      requests.push(
        sb.from("installations").select("id, status").eq("project_id", projectId).in("survey_id", installerAssignedSurveyIds)
      )
    }

    const results = await Promise.all(requests)
    for (const r of results) {
      if (r.error) throw r.error
    }

    // Deduplicate and count by status
    const seenIds = new Set<string>()
    let pending = 0
    let inProgress = 0
    let completed = 0
    let inspectionPending = 0

    for (const r of results) {
      for (const row of (r.data ?? []) as { id: string; status: string }[]) {
        if (!row?.id || seenIds.has(row.id)) continue
        seenIds.add(row.id)
        switch (row.status) {
          case "pending": pending++; break
          case "in_progress": inProgress++; break
          case "completed": completed++; break
          case "inspection_pending": inspectionPending++; break
        }
      }
    }

    return {
      total: pending + inProgress + completed + inspectionPending,
      pending,
      inProgress,
      completed,
      inspectionPending,
    }
  }

  // Fallback: use head counts without installer scoping
  const [pendingRes, inProgressRes, completedRes, inspectionPendingRes] = await Promise.all([
    supabase.from("installations").select("id", { count: "exact", head: false }).eq("project_id", projectId).eq("status", "pending"),
    supabase.from("installations").select("id", { count: "exact", head: false }).eq("project_id", projectId).eq("status", "in_progress"),
    supabase.from("installations").select("id", { count: "exact", head: false }).eq("project_id", projectId).eq("status", "completed"),
    supabase.from("installations").select("id", { count: "exact", head: false }).eq("project_id", projectId).eq("status", "inspection_pending"),
  ])

  if (pendingRes.error) throw pendingRes.error
  if (inProgressRes.error) throw inProgressRes.error
  if (completedRes.error) throw completedRes.error
  if (inspectionPendingRes.error) throw inspectionPendingRes.error

  const pending = pendingRes.count ?? 0
  const inProgress = inProgressRes.count ?? 0
  const completed = completedRes.count ?? 0
  const inspectionPending = inspectionPendingRes.count ?? 0
  return {
    total: pending + inProgress + completed + inspectionPending,
    pending,
    inProgress,
    completed,
    inspectionPending,
  }
}

/** Distinct surveys (among assignedSurveyIds) that already have ≥1 installation row in the project. */
export async function countDistinctAssignedSurveysHavingInstallation(
  supabase: SupabaseClient<Database>,
  projectId: string,
  assignedSurveyIds: string[],
): Promise<number> {
  if (assignedSurveyIds.length === 0) return 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from("installations")
    .select("survey_id")
    .eq("project_id", projectId)
    .in("survey_id", assignedSurveyIds)
  if (error) throw error
  const ids = ((data ?? []) as { survey_id: string | null }[])
    .map((r) => r.survey_id)
    .filter((sid): sid is string => Boolean(sid))
  return new Set(ids).size
}
