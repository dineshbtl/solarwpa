import { NextResponse } from "next/server"
import { assertModuleAction } from "@/lib/server/authz"
import { assignSurveyInstallerWithServiceRole } from "@/lib/supabase/surveys-server"

export async function POST(request: Request) {
  try {
    const actor = await assertModuleAction(request, "surveys", "edit")
    if (!["admin", "manager", "engineer", "supervisor"].includes(actor.role)) {
      throw new Error("Forbidden: role cannot assign installer")
    }

    const body = await request.json()
    const assignments = body.assignments as { surveyId: string; installerId: string }[]

    if (!Array.isArray(assignments)) {
      throw new Error("Invalid request body")
    }

    let successCount = 0
    let failureCount = 0

    // Process sequentially to avoid DB connection pool exhaustion if thousands of rows are sent
    for (const { surveyId, installerId } of assignments) {
      if (!surveyId) continue
      try {
        await assignSurveyInstallerWithServiceRole(surveyId, installerId, actor)
        successCount++
      } catch (err) {
        console.error(`Bulk assign error for ${surveyId}:`, err)
        failureCount++
      }
    }

    return NextResponse.json({ success: true, successCount, failureCount })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to bulk assign" },
      { status: 500 }
    )
  }
}
