import { NextResponse } from "next/server"
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"
import { tryResolveAuthenticatedActor } from "@/lib/server/authz"
import { getInstallationsKpiForProject } from "@/lib/server/installations-kpi"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}

const INSTALLER_ASSIGNED_SURVEY_CAP = 500

export async function GET(req: Request) {
  try {
    const actor = await tryResolveAuthenticatedActor(req)
    const installerScopeProfileId = actor?.role === "installer" ? actor.userId : undefined

    const supabase = createSupabaseServerClient({ useServiceRole: true })

    let installerAssignedSurveyIds: string[] = []
    if (installerScopeProfileId) {
      const { data: assignedRows, error: assignedErr } = await q(supabase)
        .from("surveys")
        .select("id")
        .eq("project_id", ACTIVE_PROJECT_ID)
        .eq("installer_id", installerScopeProfileId)
      if (assignedErr) throw assignedErr
      installerAssignedSurveyIds = ((assignedRows ?? []) as { id: string }[])
        .map((r) => r.id)
        .filter(Boolean)
        .slice(0, INSTALLER_ASSIGNED_SURVEY_CAP)
    }

    const kpi = await getInstallationsKpiForProject(supabase, ACTIVE_PROJECT_ID, {
      engineerProfileId: installerScopeProfileId,
      installerAssignedSurveyIds,
    })

    return NextResponse.json(kpi, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load installation KPI"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
