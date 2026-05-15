import { NextResponse } from "next/server"
import { assertModuleAction } from "@/lib/server/authz"
import { buildUploadsFromFormData, updateSurveyWithServiceRole } from "@/lib/supabase/surveys-server"
import type { CreateSurveyInput, Survey } from "@/lib/store/surveys"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Failed to update survey"
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
    if (!["admin", "manager", "supervisor", "surveyor", "engineer"].includes(actor.role)) {
      throw new Error("Forbidden: role cannot update surveys")
    }

    const formData = await request.formData()
    const id = formData.get("id")
    if (typeof id !== "string" || !id) throw new Error("Missing survey id")
    const inputJson = formData.get("input")
    if (typeof inputJson !== "string") throw new Error("Missing input")
    const input = JSON.parse(inputJson) as CreateSurveyInput
    const siteDetailsJson = formData.get("siteDetails")
    const siteDetails =
      typeof siteDetailsJson === "string" && siteDetailsJson
        ? (JSON.parse(siteDetailsJson) as Survey["siteDetails"])
        : undefined

    const uploadsWithUrls = await buildUploadsFromFormData(id, formData)
    const survey = await updateSurveyWithServiceRole(id, input, uploadsWithUrls, siteDetails, actor.userId)
    return NextResponse.json({ survey })
  } catch (error) {
    const message = getErrorMessage(error)
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) })
  }
}
