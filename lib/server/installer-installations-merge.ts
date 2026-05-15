/**
 * Installer-visible installations: engineer on row OR survey assigned to installer.
 * Uses two simple PostgREST queries and merges in-process — avoids fragile `.or(...)` + `.range()`
 * combinations that can return empty rows while head-count queries still succeed.
 */
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"
import type { Installation } from "@/lib/store/installations"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseQ = (client: any) => { from: (table: string) => any }

export type InstallationListRow = {
  id: string
  project_id: string | null
  survey_id: string | null
  customer_name: string
  address: string
  engineer_name: string | null
  engineer_id: string | null
  status: Installation["status"]
  started_at: string | null
  completed_at: string | null
  created_at: string
}

const INSTALL_LIST_SELECT =
  "id,project_id,survey_id,customer_name,address,engineer_name,engineer_id,status,started_at,completed_at,created_at"

export type InstallerInstallationsMergeParams = {
  q: SupabaseQ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  profileId: string
  assignedSurveyIds: string[]
  search: string
  status: string
  surveyIdsForContact: string[]
  escapeIlike: (value: string) => string
}

function applySearchStatusToQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  search: string,
  status: string,
  surveyIdsForContact: string[],
  escapeIlike: (value: string) => string,
) {
  let qy = query
  if (status) qy = qy.eq("status", status)
  if (search) {
    const term = escapeIlike(search)
    const pattern = `%${term}%`
    const parts = [
      `customer_name.ilike.${pattern}`,
      `address.ilike.${pattern}`,
      `id.ilike.${pattern}`,
      `survey_id.ilike.${pattern}`,
    ]
    if (surveyIdsForContact.length > 0) {
      parts.push(`survey_id.in.(${surveyIdsForContact.join(",")})`)
    }
    qy = qy.or(parts.join(","))
  }
  return qy
}

/** All matching installation IDs, newest `created_at` first (deduped). */
export async function installerInstallationIdsNewestFirst(
  params: InstallerInstallationsMergeParams,
): Promise<string[]> {
  const { q, supabase, profileId, assignedSurveyIds, search, status, surveyIdsForContact, escapeIlike } = params

  let qEng = q(supabase)
    .from("installations")
    .select("id, created_at")
    .eq("project_id", ACTIVE_PROJECT_ID)
    .eq("engineer_id", profileId)
  qEng = applySearchStatusToQuery(qEng, search, status, surveyIdsForContact, escapeIlike)

  const requests: Promise<{ data: unknown; error: unknown }>[] = [qEng]

  if (assignedSurveyIds.length > 0) {
    let qSurv = q(supabase)
      .from("installations")
      .select("id, created_at")
      .eq("project_id", ACTIVE_PROJECT_ID)
      .in("survey_id", assignedSurveyIds)
    qSurv = applySearchStatusToQuery(qSurv, search, status, surveyIdsForContact, escapeIlike)
    requests.push(qSurv)
  }

  const results = await Promise.all(requests)
  for (const r of results) {
    if (r.error) throw r.error
  }

  const newestCreated = new Map<string, string>()
  for (const r of results) {
    for (const row of (r.data ?? []) as { id: string; created_at: string }[]) {
      if (!row?.id) continue
      const prev = newestCreated.get(row.id)
      if (!prev || new Date(row.created_at).getTime() > new Date(prev).getTime()) {
        newestCreated.set(row.id, row.created_at)
      }
    }
  }

  return [...newestCreated.entries()]
    .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
    .map(([id]) => id)
}

export async function listInstallerInstallationsMerged(
  params: InstallerInstallationsMergeParams & { limit: number; offset: number },
): Promise<{ rows: InstallationListRow[]; total: number }> {
  const { q, supabase, limit, offset } = params

  const sortedIds = await installerInstallationIdsNewestFirst(params)
  const total = sortedIds.length
  const pageIds = sortedIds.slice(offset, offset + limit)

  if (pageIds.length === 0) {
    return { rows: [], total }
  }

  const { data: fullRows, error } = await q(supabase)
    .from("installations")
    .select(INSTALL_LIST_SELECT)
    .in("id", pageIds)

  if (error) throw error

  const orderIndex = new Map(pageIds.map((id, i) => [id, i]))
  const rows = ((fullRows ?? []) as InstallationListRow[]).sort(
    (a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
  )

  return { rows, total }
}
