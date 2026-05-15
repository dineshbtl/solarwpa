import { NextResponse } from "next/server"
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { assertModuleAction, assertRoleAllowed } from "@/lib/server/authz"
import type { Role } from "@/lib/rbac"
import { validateDispatchInsertServer, validateInwardInsertServer } from "@/lib/inventory/server-validate"

type Step = "inward" | "dispatch" | "house_allocation" | "installation_complete"

type WarehouseItem = {
  name: string
  qty: number
  unit?: string
  serialNos?: string[]
  barcodes?: string[]
  notes?: string
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [maybe.message, maybe.details, maybe.hint, maybe.code].filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0
    )
    if (parts.length > 0) return parts.join(" | ")
  }
  return "Unexpected error"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}

async function nextIdByPrefix(table: string, prefix: string, width = 3): Promise<string> {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  const { data, error } = await (supabase as unknown as {
    rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: string | null; error: unknown }>
  }).rpc("next_prefixed_id", {
    p_key: table,
    p_prefix: prefix,
    p_width: width,
  })
  if (error) throw error
  if (!data) throw new Error(`Failed to generate id for ${table}`)
  return data
}

async function createInward(data: {
  warehouseId?: string
  inwardDate: string
  poNumber: string
  refNo?: string
  supplierName?: string
  items: WarehouseItem[]
  notes?: string
  createdBy?: string
}) {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  await validateInwardInsertServer(supabase, data.items)
  const id = await nextIdByPrefix("material_inward", "INW-")
  const row = {
    id,
    warehouse_id: data.warehouseId ?? null,
    inward_date: data.inwardDate,
    po_number: data.poNumber,
    ref_no: data.refNo ?? null,
    supplier_name: data.supplierName ?? null,
    items: data.items,
    notes: data.notes ?? null,
    created_by: data.createdBy ?? null,
  }
  const { data: saved, error } = await q(supabase).from("material_inward").insert(row).select().single()
  if (error) throw error
  return saved
}

async function createDispatch(data: {
  fromWarehouseId?: string
  toWarehouseId?: string
  dispatchDate: string
  vehicleNo?: string
  driverName?: string
  driverMobile?: string
  vehicleType?: string
  fromLocation?: string
  toLocation?: string
  dispatchedBy?: string
  items: WarehouseItem[]
  notes?: string
}) {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  await validateDispatchInsertServer(supabase, {
    items: data.items,
    fromWarehouseId: data.fromWarehouseId,
  })
  const id = await nextIdByPrefix("material_dispatch", "DC-")
  const row = {
    id,
    dc_number: id,
    from_warehouse_id: data.fromWarehouseId ?? null,
    to_warehouse_id: data.toWarehouseId ?? null,
    dispatch_date: data.dispatchDate,
    vehicle_no: data.vehicleNo ?? null,
    driver_name: data.driverName ?? null,
    driver_mobile: data.driverMobile ?? null,
    vehicle_type: data.vehicleType ?? null,
    from_location: data.fromLocation ?? null,
    to_location: data.toLocation ?? null,
    dispatched_by: data.dispatchedBy ?? null,
    items: data.items,
    notes: data.notes ?? null,
    status: "dispatched",
  }
  const { data: saved, error } = await q(supabase).from("material_dispatch").insert(row).select().single()
  if (error) throw error
  return saved
}

async function createHouseAllocation(data: {
  dispatchId?: string
  toHouseholdId: string
  materialName: string
  qty: number
  unit?: string
  serialNos?: string[]
  notes?: string
}) {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  const id = await nextIdByPrefix("house_material_delivery", "HDL-", 4)
  const serialNos = [...new Set((data.serialNos ?? []).map((s) => s.trim()).filter(Boolean))]
  const row = {
    id,
    dispatch_id: data.dispatchId ?? null,
    from_entity_type: "warehouse",
    from_entity_id: null,
    to_household_id: data.toHouseholdId,
    material_name: data.materialName,
    qty: data.qty,
    unit: data.unit ?? null,
    serial_nos: serialNos,
    status: "allocated",
    notes: data.notes ?? null,
  }
  const { data: saved, error } = await q(supabase).from("house_material_delivery").insert(row).select().single()
  if (error) throw error
  return saved
}

async function ensureInstallationAndComplete(data: {
  installationId: string
  householdId: string
  materialName: string
  serialNos: string[]
  customerName?: string
  address?: string
}) {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  const serialNos = [...new Set(data.serialNos.map((s) => s.trim()).filter(Boolean))]
  const now = new Date().toISOString()

  const { data: existing, error: existingError } = await q(supabase)
    .from("installations")
    .select("id")
    .eq("id", data.installationId)
    .maybeSingle()
  if (existingError) throw existingError

  if (!existing) {
    const row = {
      id: data.installationId,
      project_id: ACTIVE_PROJECT_ID,
      customer_name: data.customerName ?? "Flow Test Customer",
      address: data.address ?? "Flow Test Address",
      status: "pending",
      materials: [],
      photos: [],
      activity: [],
    }
    const { error: createError } = await q(supabase).from("installations").insert(row)
    if (createError) throw createError
  }

  const { data: allocations, error: allocError } = await q(supabase)
    .from("house_material_delivery")
    .select("id, serial_nos, status")
    .eq("to_household_id", data.householdId)
    .ilike("material_name", data.materialName)
  if (allocError) throw allocError

  const target = new Set(serialNos.map((s) => s.toLowerCase()))
  const updateIds: string[] = []
  for (const row of allocations ?? []) {
    const rowSerials = ((row.serial_nos as string[]) ?? []).map((s) => s.trim())
    const hasAny = rowSerials.some((s) => target.has(s.toLowerCase()))
    if (!hasAny) continue
    updateIds.push(String(row.id))
  }

  if (updateIds.length > 0) {
    const { error: markError } = await q(supabase)
      .from("house_material_delivery")
      .update({ status: "installed", installed_ref_id: data.installationId })
      .in("id", updateIds)
    if (markError) throw markError
  }

  const { data: updated, error: updateError } = await q(supabase)
    .from("installations")
    .update({ status: "completed", completed_at: now })
    .eq("id", data.installationId)
    .select()
    .single()
  if (updateError) throw updateError
  return updated
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { step?: Step; data?: Record<string, unknown> }
    const step = body.step
    const data = body.data ?? {}
    if (!step) {
      return NextResponse.json({ error: "Missing step" }, { status: 400 })
    }

    const allowedRolesByStep: Record<Step, Role[]> = {
      inward: ["admin", "manager", "store_manager", "supervisor", "state_store_officer", "district_store_incharge"],
      dispatch: ["admin", "manager", "store_manager", "supervisor", "state_store_officer", "district_store_incharge"],
      house_allocation: ["admin", "manager", "store_manager", "supervisor", "state_store_officer", "district_store_incharge"],
      installation_complete: ["admin", "manager", "supervisor", "installer", "engineer"],
    }
    await assertModuleAction(request, "warehouse", "edit")
    await assertRoleAllowed(request, allowedRolesByStep[step])

    if (step === "inward") {
      const saved = await createInward({
        warehouseId: typeof data.warehouseId === "string" ? data.warehouseId : undefined,
        inwardDate: String(data.inwardDate ?? new Date().toISOString().slice(0, 10)),
        poNumber: String(data.poNumber ?? ""),
        refNo: typeof data.refNo === "string" ? data.refNo : undefined,
        supplierName: typeof data.supplierName === "string" ? data.supplierName : undefined,
        items: (data.items as WarehouseItem[]) ?? [],
        notes: typeof data.notes === "string" ? data.notes : undefined,
        createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
      })
      return NextResponse.json({ ok: true, step, result: saved })
    }

    if (step === "dispatch") {
      const saved = await createDispatch({
        fromWarehouseId: typeof data.fromWarehouseId === "string" ? data.fromWarehouseId : undefined,
        toWarehouseId: typeof data.toWarehouseId === "string" ? data.toWarehouseId : undefined,
        dispatchDate: String(data.dispatchDate ?? new Date().toISOString().slice(0, 10)),
        vehicleNo: typeof data.vehicleNo === "string" ? data.vehicleNo : undefined,
        driverName: typeof data.driverName === "string" ? data.driverName : undefined,
        driverMobile: typeof data.driverMobile === "string" ? data.driverMobile : undefined,
        vehicleType: typeof data.vehicleType === "string" ? data.vehicleType : undefined,
        fromLocation: typeof data.fromLocation === "string" ? data.fromLocation : undefined,
        toLocation: typeof data.toLocation === "string" ? data.toLocation : undefined,
        dispatchedBy: typeof data.dispatchedBy === "string" ? data.dispatchedBy : undefined,
        items: (data.items as WarehouseItem[]) ?? [],
        notes: typeof data.notes === "string" ? data.notes : undefined,
      })
      return NextResponse.json({ ok: true, step, result: saved })
    }

    if (step === "house_allocation") {
      const saved = await createHouseAllocation({
        dispatchId: typeof data.dispatchId === "string" ? data.dispatchId : undefined,
        toHouseholdId: String(data.toHouseholdId ?? ""),
        materialName: String(data.materialName ?? ""),
        qty: Number(data.qty ?? 0),
        unit: typeof data.unit === "string" ? data.unit : undefined,
        serialNos: (data.serialNos as string[]) ?? [],
        notes: typeof data.notes === "string" ? data.notes : undefined,
      })
      return NextResponse.json({ ok: true, step, result: saved })
    }

    if (step === "installation_complete") {
      const saved = await ensureInstallationAndComplete({
        installationId: String(data.installationId ?? ""),
        householdId: String(data.householdId ?? ""),
        materialName: String(data.materialName ?? "Solar PV Module"),
        serialNos: (data.serialNos as string[]) ?? [],
        customerName: typeof data.customerName === "string" ? data.customerName : undefined,
        address: typeof data.address === "string" ? data.address : undefined,
      })
      return NextResponse.json({ ok: true, step, result: saved })
    }

    return NextResponse.json({ error: `Unsupported step: ${String(step)}` }, { status: 400 })
  } catch (error) {
    const message = errorMessage(error)
    const status =
      message.toLowerCase().includes("unauthorized")
        ? 401
        : message.toLowerCase().includes("forbidden")
          ? 403
          : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
