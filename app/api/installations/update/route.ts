import { NextResponse } from "next/server"
import { updateInstallationWithServiceRoleFromFormData } from "@/lib/supabase/installations-server"
import { assertAnyPermission } from "@/lib/server/authz"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [maybe.message, maybe.details, maybe.hint, maybe.code].filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0
    )
    if (parts.length > 0) return parts.join(" | ")
  }
  return "Failed to update installation"
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

export async function POST(request: Request) {
  const startedAt = Date.now()
  const reqId = `ins_update_${crypto.randomUUID().slice(0, 12)}`
  const contentLength = request.headers.get("content-length")
  console.info("[installations/update] inbound", {
    reqId,
    contentLength,
    contentType: request.headers.get("content-type")?.slice(0, 120) ?? null,
    ua: request.headers.get("user-agent")?.slice(0, 160) ?? null,
  })
  try {
    const actor = await assertAnyPermission(request, ["installations.edit", "update_installations"])
    console.info("[installations/update] auth_ok", {
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
    const installationId = formData.get("installationId")
    if (typeof installationId !== "string" || !installationId) {
      throw new Error("Missing installation id")
    }
    console.info("[installations/update] body_received", {
      reqId,
      installationId,
      actorRole: actor.role,
      actorId: actor.userId,
      fileCount,
      approxMb: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
      elapsedMsSinceStart: Date.now() - startedAt,
    })

    if (actor.role === "installer") {
      const supabase = createSupabaseServerClient({ useServiceRole: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = (client: any): { from: (table: string) => any } => client as unknown as { from: (table: string) => any }
      const { data: row, error } = await q(supabase)
        .from("installations")
        .select("engineer_id, survey_id")
        .eq("id", installationId)
        .maybeSingle() as { data: { engineer_id?: string | null; survey_id?: string | null } | null; error: unknown }
      if (error) throw new Error("Could not validate installation assignment")
      if (!row) throw new Error("Installation not found")

      let surveyDistrict: string | undefined
      const isEngineerAssigned = row.engineer_id === actor.userId
      if (!isEngineerAssigned) {
        if (!row.survey_id) {
          throw new Error("Forbidden: installer can update only assigned installations")
        }
        const { data: survey, error: surveyErr } = await q(supabase)
          .from("surveys")
          .select("installer_id, site_location")
          .eq("id", row.survey_id)
          .maybeSingle() as { data: { installer_id?: string | null; site_location?: { district?: string } } | null; error: unknown }
        if (surveyErr) throw new Error("Could not validate survey assignment")
        if (survey?.installer_id !== actor.userId) {
          throw new Error("Forbidden: installer can update only assigned installations")
        }
        surveyDistrict = survey.site_location?.district
      }

      // Validate installer's assigned locations (skip if column doesn't exist)
      let assignedLocations: string[] = []
      try {
        const { data: profile, error: profileErr } = await q(supabase)
          .from("profiles")
          .select("assigned_locations")
          .eq("id", actor.userId)
          .maybeSingle() as { data: { assigned_locations?: string[] | null } | null; error: unknown }
        const profileErrMsg =
          profileErr && typeof profileErr === "object" && profileErr !== null && "message" in profileErr
            ? String((profileErr as { message?: unknown }).message ?? "")
            : ""
        if (profileErr && !profileErrMsg.toLowerCase().includes("column")) {
          throw profileErr
        }
        assignedLocations = profile?.assigned_locations ?? []
      } catch {
        // Column doesn't exist, skip location validation
        assignedLocations = []
      }
      if (assignedLocations.length > 0 && row.survey_id) {
        if (!surveyDistrict) {
          const { data: survey, error: surveyErr } = await q(supabase)
            .from("surveys")
            .select("site_location")
            .eq("id", row.survey_id)
            .maybeSingle() as { data: { site_location?: { district?: string } } | null; error: unknown }
          if (surveyErr) throw new Error("Could not validate survey location")
          surveyDistrict = survey?.site_location?.district
        }
        if (!surveyDistrict || !assignedLocations.includes(surveyDistrict)) {
          throw new Error("Forbidden: installation is not in your assigned locations")
        }
      }
    }

    const installation = await updateInstallationWithServiceRoleFromFormData(formData)
    console.info("[installations/update] success", {
      reqId,
      installationId: installation.id,
      elapsedMs: Date.now() - startedAt,
    })
    return NextResponse.json({ installation })
  } catch (error) {
    const message = getErrorMessage(error)
    const status = getErrorStatus(error)
    console.error("[installations/update] failed", {
      reqId,
      status,
      message,
      elapsedMs: Date.now() - startedAt,
    })
    return NextResponse.json({ error: message }, { status })
  }
}
