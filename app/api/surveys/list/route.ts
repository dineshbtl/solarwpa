import { NextResponse } from "next/server"
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"
import { tryResolveAuthenticatedActor } from "@/lib/server/authz"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const limitRaw = Number(searchParams.get("limit") ?? 20)
    const offsetRaw = Number(searchParams.get("offset") ?? 0)
    const search = (searchParams.get("search") ?? "").trim()
    const forInstaller = searchParams.get("forInstaller") === "1"

    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0

    const actor = await tryResolveAuthenticatedActor(req)
    const supabase = createSupabaseServerClient({ useServiceRole: true })

    let installerAssignedLocations: string[] = []
    const isInstaller = actor?.role === "installer"

    // For installers or when forInstaller flag is set, get assigned locations
    if (isInstaller || forInstaller) {
      const profileId = actor?.userId
      if (profileId) {
        try {
          const { data: profileData } = await q(supabase)
            .from("profiles")
            .select("assigned_locations")
            .eq("id", profileId)
            .maybeSingle()
          installerAssignedLocations = (profileData?.assigned_locations as string[]) ?? []
        } catch {
          installerAssignedLocations = []
        }
      }
    }

    // Build the query
    let query = q(supabase)
      .from("surveys")
      .select("id, beneficiary_name, service_no, aadhar_no, mobile, status, site_location, installer_id", { count: "exact" })
      .eq("project_id", ACTIVE_PROJECT_ID)
      .order("created_at", { ascending: false })

    // For installers, only show surveys assigned to them
    if (isInstaller && actor?.userId) {
      query = query.eq("installer_id", actor.userId)
    }

    // Apply search
    if (search) {
      const term = escapeIlike(search)
      const pattern = `%${term}%`
      query = query.or(
        `beneficiary_name.ilike.${pattern},service_no.ilike.${pattern},id.ilike.${pattern},aadhar_no.ilike.${pattern},mobile.ilike.${pattern}`
      )
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) throw error

    // Filter by assigned locations if installer has location restrictions
    let items = (data ?? []) as Array<{
      id: string
      beneficiary_name: string
      service_no: string
      aadhar_no?: string
      mobile?: string
      status: string
      site_location?: { district?: string }
      installer_id?: string
    }>

    if (installerAssignedLocations.length > 0) {
      items = items.filter((s) => {
        const district = s.site_location?.district
        return district && installerAssignedLocations.includes(district)
      })
    }

    // Map to response format
    const surveys = items.map((s) => ({
      id: s.id,
      beneficiaryName: s.beneficiary_name,
      serviceNo: s.service_no,
      aadharNo: s.aadhar_no,
      mobile: s.mobile,
      status: s.status,
      district: s.site_location?.district,
    }))

    return NextResponse.json({
      items: surveys,
      total: installerAssignedLocations.length > 0 ? surveys.length : (count ?? surveys.length),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load surveys"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
