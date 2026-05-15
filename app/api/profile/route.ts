import { NextResponse } from "next/server"
import { resolveAuthenticatedActor, tryResolveAuthenticatedActor } from "@/lib/server/authz"
import { normalizeAppRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"
import type { User } from "@/lib/store/users"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

function rowToUser(row: ProfileRow): User {
  const safeRole = normalizeAppRole(String(row.role)) ?? "surveyor"
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: safeRole,
    status: row.status,
    createdAt: row.created_at,
    phone: row.phone ?? undefined,
    aadharNo: row.aadhar_no ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    district: row.district ?? undefined,
    fullAddress: row.full_address ?? undefined,
  }
}

/** Current user's profile (service role read; works when RLS / anon differs from app). */
export async function GET(req: Request) {
  try {
    const actor = await tryResolveAuthenticatedActor(req)
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized: missing bearer token" }, { status: 401 })
    }

    const supabase = createSupabaseServerClient({ useServiceRole: true })
    const { data, error } = await q(supabase).from("profiles").select("*").eq("id", actor.userId).maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json(
      { profile: rowToUser(data as ProfileRow) },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profile"
    const status = message.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

/** Self-service profile update: safe columns only; email/role/status/password ignored. */
export async function PATCH(req: Request) {
  try {
    const actor = await resolveAuthenticatedActor(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const updates: Record<string, unknown> = {}

    if (typeof body.name === "string") {
      const name = body.name.trim()
      if (name.length > 0 && name.length < 2) {
        return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 })
      }
      if (name.length >= 2) updates.name = name
    }

    if (typeof body.phone === "string") {
      updates.phone = body.phone.trim() || null
    }
    if (typeof body.aadharNo === "string") {
      const d = body.aadharNo.replace(/\D/g, "")
      if (d.length > 0 && d.length !== 12) {
        return NextResponse.json({ error: "Aadhaar must be 12 digits" }, { status: 400 })
      }
      updates.aadhar_no = d.length === 12 ? d : null
    }
    if (typeof body.city === "string") updates.city = body.city.trim() || null
    if (typeof body.state === "string") updates.state = body.state.trim() || null
    if (typeof body.district === "string") updates.district = body.district.trim() || null
    if (typeof body.fullAddress === "string") updates.full_address = body.fullAddress.trim() || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient({ useServiceRole: true })
    const { data, error } = await q(supabase)
      .from("profiles")
      .update(updates)
      .eq("id", actor.userId)
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error("Profile not found")

    return NextResponse.json({ profile: rowToUser(data as ProfileRow) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile"
    const status = message.includes("Unauthorized") ? 401 : message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
