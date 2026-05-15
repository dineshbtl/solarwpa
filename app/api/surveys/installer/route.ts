import { NextResponse } from "next/server"
import { assertModuleAction } from "@/lib/server/authz"
import { assignSurveyInstallerWithServiceRole } from "@/lib/supabase/surveys-server"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Failed to assign installer"
}

function getErrorStatus(error: unknown): number {
  const message = getErrorMessage(error).toLowerCase()
  if (message.includes("unauthorized")) return 401
  if (message.includes("forbidden")) return 403
  if (message.includes("missing") || message.includes("invalid") || message.includes("cannot")) return 400
  return 500
}

export async function POST(request: Request) {
  try {
    const actor = await assertModuleAction(request, "surveys", "edit")
    if (!["admin", "manager", "engineer", "supervisor"].includes(actor.role)) {
      throw new Error("Forbidden: role cannot assign installer")
    }
    const body = (await request.json()) as { surveyId?: string; installerId?: string | null }
    if (!body?.surveyId) {
      throw new Error("Missing surveyId")
    }
    const survey = await assignSurveyInstallerWithServiceRole(
      body.surveyId,
      body.installerId ?? undefined,
      actor
    )
    return NextResponse.json({ survey })
  } catch (error) {
    const message = getErrorMessage(error)
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) })
  }
}
