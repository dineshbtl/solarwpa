import { NextResponse } from "next/server"
import { createInstallationWithServiceRoleFromFormData } from "@/lib/supabase/installations-server"
import { assertAnyPermission } from "@/lib/server/authz"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function supervisorWorkflowCompleted(siteDetails: unknown): boolean {
  if (!siteDetails || typeof siteDetails !== "object") return false
  const obj = siteDetails as Record<string, unknown>
  const civil = String(obj.supervisorCivilWorkStatus ?? "").toLowerCase()
  const site = String(obj.supervisorSiteConditionStatus ?? "").toLowerCase()
  const readyFlag = obj.supervisorReadyForEngineer === true
  return (civil === "completed" && site === "completed") || readyFlag
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [maybe.message, maybe.details, maybe.hint, maybe.code].filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0
    )
    if (parts.length > 0) return parts.join(" | ")
  }
  return "Failed to create installation"
}

function getErrorStatus(error: unknown): number {
  const message = getErrorMessage(error).toLowerCase()
  if (message.includes("unauthorized")) return 401
  if (message.includes("forbidden")) return 403
  if (
    message.includes("content-type") ||
    message.includes("form-data") ||
    message.includes("missing ")
  ) {
    return 400
  }
  return 500
}

type InstallationCreateRequestInput = {
  engineerId?: string | null
  engineerName?: string | null
  surveyId?: string | null
  supervisorCivilWorkCompleted?: boolean
  supervisorSiteConditionCompleted?: boolean
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const reqId = `ins_create_${crypto.randomUUID().slice(0, 12)}`
  const contentLength = request.headers.get("content-length")
  console.info("[installations/create] inbound", {
    reqId,
    contentLength,
    contentType: request.headers.get("content-type")?.slice(0, 120) ?? null,
    ua: request.headers.get("user-agent")?.slice(0, 160) ?? null,
  })
  try {
    const actor = await assertAnyPermission(request, ["installations.create", "create_installations"])
    console.info("[installations/create] auth_ok", {
      reqId,
      actorRole: actor.role,
      elapsedMs: Date.now() - startedAt,
    })
    const formData = await request.formData()
    let fileCount = 0
    let totalBytes = 0
    for (const [, value] of formData.entries()) {
      if (value instanceof Blob) {
        fileCount += 1
        totalBytes += value.size
      } else if (typeof value === "string") {
        totalBytes += value.length
      }
    }
    console.info("[installations/create] body_received", {
      reqId,
      actorRole: actor.role,
      actorId: actor.userId,
      fileCount,
      approxMb: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
      elapsedMsSinceStart: Date.now() - startedAt,
    })
    const inputJson = formData.get("input")
    if (typeof inputJson === "string") {
      const input = JSON.parse(inputJson) as InstallationCreateRequestInput
      if (actor.role === "engineer" && input.engineerId && input.engineerId !== actor.userId) {
        throw new Error("Forbidden: engineers can create installations only for self-assigned sites")
      }
      if (actor.role === "installer" && !input.surveyId) {
        throw new Error("Forbidden: installers can create installations only for assigned surveys")
      }
      if (input.surveyId) {
        const supabase = createSupabaseServerClient({ useServiceRole: true })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q = (client: any): { from: (table: string) => any } => client as unknown as { from: (table: string) => any }
        const { data: survey, error } = await q(supabase)
          .from("surveys")
          .select("site_details, installer_id, site_location")
          .eq("id", input.surveyId)
          .maybeSingle() as { data: { site_details?: unknown; installer_id?: string | null; site_location?: { district?: string } } | null; error: unknown }
        if (error) throw new Error("Could not validate survey workflow status")
        if (!survey) throw new Error("Survey not found")

        const siteDetails =
          survey.site_details && typeof survey.site_details === "object" && !Array.isArray(survey.site_details)
            ? { ...(survey.site_details as Record<string, unknown>) }
            : {}
        let shouldPatchSurveyReadiness = false
        if (input.supervisorCivilWorkCompleted) {
          siteDetails.supervisorCivilWorkStatus = "completed"
          shouldPatchSurveyReadiness = true
        }
        if (input.supervisorSiteConditionCompleted) {
          siteDetails.supervisorSiteConditionStatus = "completed"
          shouldPatchSurveyReadiness = true
        }
        if (input.supervisorCivilWorkCompleted && input.supervisorSiteConditionCompleted) {
          siteDetails.supervisorReadyForEngineer = true
          siteDetails.supervisorReadinessConfirmedAt = new Date().toISOString()
          shouldPatchSurveyReadiness = true
        }

        if (!supervisorWorkflowCompleted(siteDetails)) {
          throw new Error("Forbidden: supervisor must complete civil work and site condition before installation creation")
        }
        if (shouldPatchSurveyReadiness) {
          const { error: readinessErr } = await q(supabase)
            .from("surveys")
            .update({ site_details: siteDetails })
            .eq("id", input.surveyId)
          if (readinessErr) throw new Error("Could not save supervisor readiness")
        }
        if (!survey.installer_id) {
          throw new Error("Assign installer before creating installation")
        }
        if (actor.role === "installer" && survey.installer_id !== actor.userId) {
          throw new Error("Forbidden: installers can create installations only for assigned surveys")
        }
        // Validate installer's assigned locations (skip if column doesn't exist)
        let assignedLocations: string[] = []
        let installerName: string | undefined
        try {
          const { data: installerProfile, error: profileErr } = await q(supabase)
            .from("profiles")
            .select("name, assigned_locations")
            .eq("id", survey.installer_id)
            .maybeSingle() as { data: { name?: string | null; assigned_locations?: string[] | null } | null; error: unknown }
          const profileErrMsg =
            profileErr && typeof profileErr === "object" && profileErr !== null && "message" in profileErr
              ? String((profileErr as { message?: unknown }).message ?? "")
              : ""
          if (profileErr && !profileErrMsg.toLowerCase().includes("column")) {
            throw profileErr
          }
          installerName = installerProfile?.name?.trim() || undefined
          assignedLocations = installerProfile?.assigned_locations ?? []
        } catch {
          // Column doesn't exist, skip location validation
          assignedLocations = []
        }
        if (assignedLocations.length > 0) {
          const surveyDistrict = survey.site_location?.district
          if (!surveyDistrict || !assignedLocations.includes(surveyDistrict)) {
            throw new Error(`Forbidden: installer is not assigned to location "${surveyDistrict || 'unknown'}". Assigned locations: ${assignedLocations.join(", ")}`)
          }
        }
        if (actor.role === "installer") {
          formData.set("input", JSON.stringify({
            ...input,
            engineerId: actor.userId,
            engineerName: input.engineerName?.trim() || installerName,
          }))
        }
      }
    }
    const installation = await createInstallationWithServiceRoleFromFormData(formData)
    console.info("[installations/create] success", {
      reqId,
      installationId: installation.id,
      elapsedMs: Date.now() - startedAt,
    })
    return NextResponse.json({ installation })
  } catch (error) {
    const message = getErrorMessage(error)
    const status = getErrorStatus(error)
    console.error("[installations/create] failed", {
      reqId,
      status,
      message,
      elapsedMs: Date.now() - startedAt,
    })
    return NextResponse.json({ error: message }, { status })
  }
}
