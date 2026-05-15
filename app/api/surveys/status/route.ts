import { NextResponse } from "next/server"
import { assertModuleAction } from "@/lib/server/authz"
import { updateSurveyStatusWithServiceRole } from "@/lib/supabase/surveys-server"
import type { Survey } from "@/lib/store/surveys"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Failed to update survey status"
}

function getErrorStatus(error: unknown): number {
  const message = getErrorMessage(error).toLowerCase()
  if (message.includes("unauthorized")) return 401
  if (message.includes("forbidden")) return 403
  if (message.includes("missing") || message.includes("invalid")) return 400
  return 500
}

export async function POST(request: Request) {
  try {
    const actor = await assertModuleAction(request, "surveys", "edit")
    if (!["admin", "manager", "supervisor"].includes(actor.role)) {
      throw new Error("Forbidden: only supervisor/manager/admin can change survey status")
    }
    const body = (await request.json()) as { surveyId?: string; status?: Survey["status"] }
    if (!body?.surveyId || !body?.status) {
      throw new Error("Missing surveyId or status")
    }
    const survey = await updateSurveyStatusWithServiceRole(body.surveyId, body.status, actor)
    return NextResponse.json({ survey })
  } catch (error) {
    const message = getErrorMessage(error)
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) })
  }
}
