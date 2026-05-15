import { getCurrentProfile } from "@/lib/data/users"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type ActivityEntityType =
  | "warehouse_inward"
  | "warehouse_dispatch"
  | "warehouse_return"
  | "warehouse_supplier_rma"
  | "warehouse_allocation"
  | "installation"

export type ActivityLogEntry = {
  id: string
  entityType: ActivityEntityType
  entityId: string
  action: string
  message: string
  actorId?: string
  actorName?: string
  meta?: Record<string, unknown>
  createdAt: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as { code?: string; message?: string }
  const msg = (e.message ?? "").toLowerCase()
  return e.code === "PGRST205" || msg.includes("could not find the table") || msg.includes("schema cache")
}

async function resolveActor(): Promise<{ actorId?: string; actorName?: string }> {
  try {
    const profile = await getCurrentProfile()
    if (!profile) return {}
    return {
      actorId: profile.id,
      actorName: profile.name || profile.email || profile.id,
    }
  } catch {
    return {}
  }
}

export async function appendActivityLog(input: {
  entityType: ActivityEntityType
  entityId: string
  action: string
  message: string
  meta?: Record<string, unknown>
}): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const actor = await resolveActor()
  const row = {
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    message: input.message,
    actor_id: actor.actorId ?? null,
    actor_name: actor.actorName ?? null,
    meta: input.meta ?? null,
  }
  const { error } = await q(sb).from("activity_logs").insert(row)
  if (error && !isMissingTableError(error)) throw error
}

export async function listEntityActivity(
  entityType: ActivityEntityType,
  entityId: string
): Promise<ActivityLogEntry[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb)
    .from("activity_logs")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
  if (error) {
    if (isMissingTableError(error)) return []
    throw error
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id ?? ""),
    entityType: String(r.entity_type) as ActivityEntityType,
    entityId: String(r.entity_id ?? ""),
    action: String(r.action ?? ""),
    message: String(r.message ?? ""),
    actorId: (r.actor_id as string) ?? undefined,
    actorName: (r.actor_name as string) ?? undefined,
    meta: (r.meta as Record<string, unknown>) ?? undefined,
    createdAt: String(r.created_at ?? ""),
  }))
}
