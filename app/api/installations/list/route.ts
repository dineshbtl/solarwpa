import { NextResponse } from "next/server"
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"
import { tryResolveAuthenticatedActor } from "@/lib/server/authz"
import {
  countDistinctAssignedSurveysHavingInstallation,
  EMPTY_INSTALLATIONS_KPI,
  getInstallationsKpiForProject,
  type InstallationsKpiPayload,
} from "@/lib/server/installations-kpi"
import {
  installerInstallationIdsNewestFirst,
  listInstallerInstallationsMerged,
  type InstallationListRow,
} from "@/lib/server/installer-installations-merge"
import { latestInstallerAssignedFromSurveyActivity } from "@/lib/server/survey-installer-activity"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/** User-scoped list counts/KPI; must not use shared HTTP cache (installers vs admins). */
const PRIVATE_JSON_HEADERS = { "Cache-Control": "private, no-store" }

// Bypass Supabase v2 complex generic inference to prevent `never` types in route handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}

/** Escape value for use in ilike pattern (%, _) */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

const MAX_SURVEY_IDS_FOR_IN = 500
const INSTALLER_ASSIGNED_SURVEY_CAP = 500

async function mapRowsToListItems(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  rawRows: InstallationListRow[],
) {
  const surveyIdsForAssign = [...new Set(rawRows.map((r) => r.survey_id).filter(Boolean) as string[])]
  const assignmentBySurvey = new Map<string, { byName?: string; at?: string }>()
  const surveyInfoById = new Map<string, { serviceNo?: string; mobile?: string; circle?: string }>()

  if (surveyIdsForAssign.length > 0) {
    const { data: survRows, error: survErr } = await q(supabase)
      .from("surveys")
      .select("id, activity, service_no, mobile, site_location")
      .in("id", surveyIdsForAssign)
    if (survErr) throw survErr

    const actorIds = new Set<string>()
    const latestBySurvey = new Map<string, { at: string; actorId?: string }>()
    for (const s of (survRows ?? []) as {
      id: string
      activity: unknown
      service_no?: string | null
      mobile?: string | null
      site_location?: { circle?: string } | null
    }[]) {
      const latest = latestInstallerAssignedFromSurveyActivity(s.activity)
      if (latest?.actorId) actorIds.add(latest.actorId)
      if (latest) latestBySurvey.set(s.id, latest)
      surveyInfoById.set(s.id, {
        serviceNo: s.service_no ?? undefined,
        mobile: s.mobile ?? undefined,
        circle: s.site_location?.circle ?? undefined,
      })
    }

    const nameById = new Map<string, string>()
    if (actorIds.size > 0) {
      const { data: profs, error: profErr } = await q(supabase)
        .from("profiles")
        .select("id, name")
        .in("id", [...actorIds])
      if (profErr) throw profErr
      for (const p of (profs ?? []) as { id: string; name: string }[]) {
        nameById.set(p.id, p.name?.trim() || p.id)
      }
    }

    for (const [sid, meta] of latestBySurvey) {
      assignmentBySurvey.set(sid, {
        at: meta.at,
        byName: meta.actorId ? nameById.get(meta.actorId) ?? meta.actorId : undefined,
      })
    }
  }

  return rawRows.map((row) => {
    const sid = row.survey_id ?? undefined
    const assign = sid ? assignmentBySurvey.get(sid) : undefined
    const surveyInfo = sid ? surveyInfoById.get(sid) : undefined
    return {
      id: row.id,
      projectId: row.project_id ?? undefined,
      surveyId: sid,
      customerName: row.customer_name,
      address: row.address,
      engineerName: row.engineer_name ?? undefined,
      engineerId: row.engineer_id ?? undefined,
      status: row.status,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      createdAt: row.created_at,
      installerAssignedByName: assign?.byName,
      installerAssignedAt: assign?.at,
      surveyServiceNo: surveyInfo?.serviceNo,
      surveyMobile: surveyInfo?.mobile,
      surveyCircle: surveyInfo?.circle,
    }
  })
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const limitRaw = Number(searchParams.get("limit") ?? 10)
    const offsetRaw = Number(searchParams.get("offset") ?? 0)
    const countMode = (searchParams.get("countMode") ?? "planned").trim().toLowerCase() === "exact" ? "exact" : "planned"
    const countOnly = searchParams.get("countOnly") === "1"
    const includeKpi = searchParams.get("includeKpi") === "1"
    const search = (searchParams.get("search") ?? "").trim()
    const status = (searchParams.get("status") ?? "").trim()

    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 10
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0

    const actor = await tryResolveAuthenticatedActor(req)
    const installerScopeProfileId = actor?.role === "installer" ? actor.userId : undefined

    const supabase = createSupabaseServerClient({ useServiceRole: true })

    let installerAssignedLocations: string[] = []
    let installerAssignedSurveyIds: string[] = []
    if (installerScopeProfileId) {
      // Try to get the installer's assigned locations (column may not exist if migration not applied)
      try {
        const { data: profileData, error: profileErr } = await q(supabase)
          .from("profiles")
          .select("assigned_locations")
          .eq("id", installerScopeProfileId)
          .maybeSingle()
        // If column doesn't exist, error code is 42703 or message mentions "column"
        if (profileErr && !String(profileErr.message ?? "").toLowerCase().includes("column")) {
          throw profileErr
        }
        installerAssignedLocations = (profileData?.assigned_locations as string[]) ?? []
      } catch (e) {
        // If assigned_locations column doesn't exist, treat as no location restriction
        console.log("[installations/list] assigned_locations not available, skipping location filter")
        installerAssignedLocations = []
      }

      // Get surveys that are assigned to this installer
      const { data: assignedRows, error: assignedErr } = await q(supabase)
        .from("surveys")
        .select("id, site_location")
        .eq("project_id", ACTIVE_PROJECT_ID)
        .eq("installer_id", installerScopeProfileId)
      if (assignedErr) throw assignedErr

      // Filter by assigned locations if any are set
      const filteredSurveys = ((assignedRows ?? []) as { id: string; site_location?: { district?: string } }[])
        .filter((r) => {
          if (installerAssignedLocations.length === 0) return true // No location restriction
          const district = r.site_location?.district
          return district && installerAssignedLocations.includes(district)
        })

      installerAssignedSurveyIds = filteredSurveys
        .map((r) => r.id)
        .filter(Boolean)
        .slice(0, INSTALLER_ASSIGNED_SURVEY_CAP)
    }

    let surveyIdsForContact: string[] = []
    if (search) {
      const term = escapeIlike(search)
      const pattern = `%${term}%`
      const { data: surveyRows, error: surveyErr } = await q(supabase)
        .from("surveys")
        .select("id")
        .eq("project_id", ACTIVE_PROJECT_ID)
        .or(`mobile.ilike.${pattern},service_no.ilike.${pattern}`)
      if (surveyErr) throw surveyErr
      surveyIdsForContact = ((surveyRows ?? []) as { id: string }[])
        .map((r) => r.id)
        .filter(Boolean)
        .slice(0, MAX_SURVEY_IDS_FOR_IN)
    }

    const installerMergeParams = () => ({
      q,
      supabase,
      profileId: installerScopeProfileId!,
      assignedSurveyIds: installerAssignedSurveyIds,
      search,
      status,
      surveyIdsForContact,
      escapeIlike,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyFilters = (query: any) => {
      let filtered = query.eq("project_id", ACTIVE_PROJECT_ID)
      if (installerScopeProfileId) {
        if (installerAssignedSurveyIds.length > 0) {
          filtered = filtered.or(
            `engineer_id.eq.${installerScopeProfileId},survey_id.in.(${installerAssignedSurveyIds.join(",")})`,
          )
        } else {
          filtered = filtered.eq("engineer_id", installerScopeProfileId)
        }
      }
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
        filtered = filtered.or(parts.join(","))
      }
      if (status) {
        filtered = filtered.eq("status", status)
      }
      return filtered
    }

    if (countOnly) {
      if (installerScopeProfileId) {
        const ids = await installerInstallationIdsNewestFirst(installerMergeParams())
        return NextResponse.json({ total: ids.length, totalIsEstimate: false }, { headers: PRIVATE_JSON_HEADERS })
      }
      const countQuery = applyFilters(q(supabase).from("installations").select("id", { count: countMode, head: true }))
      const { error, count } = await countQuery
      if (error) throw error
      return NextResponse.json(
        { total: count ?? 0, totalIsEstimate: countMode !== "exact" },
        { headers: PRIVATE_JSON_HEADERS },
      )
    }

    const wantsKpiBundled = includeKpi && offset === 0 && !search && !status
    const kpiPromise = wantsKpiBundled
      ? getInstallationsKpiForProject(supabase, ACTIVE_PROJECT_ID, {
          engineerProfileId: installerScopeProfileId,
          installerAssignedSurveyIds,
        }).catch((err) => {
          console.error("[installations/list] bundled KPI failed:", err)
          return EMPTY_INSTALLATIONS_KPI
        })
      : Promise.resolve(null)

    const installerSurveyAssignPromise =
      wantsKpiBundled && installerScopeProfileId
        ? countDistinctAssignedSurveysHavingInstallation(supabase, ACTIVE_PROJECT_ID, installerAssignedSurveyIds).catch(
            () => 0,
          )
        : Promise.resolve(null)

    function mergeInstallerKpi(
      kpiBundled: InstallationsKpiPayload | null,
      householdsWithInstallation: number | null,
    ): InstallationsKpiPayload & {
      surveyAssignment?: {
        assignedHouseholds: number
        householdsWithInstallation: number
        householdsPendingInstallation: number
      }
    } {
      const base = kpiBundled ?? EMPTY_INSTALLATIONS_KPI
      if (!installerScopeProfileId || householdsWithInstallation == null) return base
      return {
        ...base,
        surveyAssignment: {
          assignedHouseholds: installerAssignedSurveyIds.length,
          householdsWithInstallation,
          householdsPendingInstallation: Math.max(0, installerAssignedSurveyIds.length - householdsWithInstallation),
        },
      }
    }

    if (installerScopeProfileId) {
      const [merged, kpiBundled, hhWithInstallation] = await Promise.all([
        listInstallerInstallationsMerged({ ...installerMergeParams(), limit, offset }),
        kpiPromise,
        installerSurveyAssignPromise,
      ])
      const items = await mapRowsToListItems(supabase, merged.rows)
      return NextResponse.json(
        {
          items,
          total: merged.total,
          totalIsEstimate: false,
          ...(wantsKpiBundled ? { kpi: mergeInstallerKpi(kpiBundled, hhWithInstallation) } : {}),
        },
        { headers: PRIVATE_JSON_HEADERS },
      )
    }

    const listQuery = applyFilters(
      q(supabase)
        .from("installations")
        .select(
          "id,project_id,survey_id,customer_name,address,engineer_name,engineer_id,status,started_at,completed_at,created_at",
          { count: countMode },
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
    )

    const [listResult, kpiBundled] = await Promise.all([listQuery, kpiPromise])

    const { data, error, count } = listResult
    if (error) throw error

    const rawRows = (data ?? []) as InstallationListRow[]
    const items = await mapRowsToListItems(supabase, rawRows)

    return NextResponse.json(
      {
        items,
        total: count ?? 0,
        totalIsEstimate: countMode !== "exact",
        ...(wantsKpiBundled ? { kpi: kpiBundled ?? EMPTY_INSTALLATIONS_KPI } : {}),
      },
      { headers: PRIVATE_JSON_HEADERS },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load installations"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
