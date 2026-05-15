import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { appendActivityLog } from "@/lib/supabase/activity-log"

// Bypass Supabase v2 complex generic type inference to prevent `never` types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: ReturnType<typeof getSupabaseBrowserClient>): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}
import {
  DEFAULT_WAREHOUSE_ID,
  type Warehouse,
  type MaterialInward,
  type MaterialDispatch,
  type MaterialReceipt,
  type MaterialIssueVillage,
  type VillageAllotment,
  type MaterialReturn,
  type SupplierMaterialReturn,
  type HouseMaterialDelivery,
  type HouseMaterialMovementEvent,
  type WarehouseItem,
  type VillageIssueItem,
} from '@/lib/store/warehouse'
import {
  assertDispatchSerialsGlobally,
  assertDispatchSerialsForWarehouse,
  assertFieldReturnSerialsForUpsert,
  buildAvailableSerialsAtWarehouse,
  collectExistingSerialsFromInwards,
  definitionsByMaterialKey,
  effectiveWarehouseItemQty,
  normalizeMaterial,
  validateInwardPayload,
} from "@/lib/inventory/stock-validation"

function isMissingWarehouseTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string }
  const msg = (e.message ?? '').toLowerCase()
  return (
    e.code === 'PGRST205' ||
    msg.includes("could not find the table") ||
    msg.includes('schema cache')
  )
}

function warehouseSetupError(): Error {
  return new Error(
    'Warehouse module is not initialized in database. Run migration 00013_installations_warehouse_roles.sql and retry.'
  )
}

function handleWarehouseReadError<T>(error: unknown, fallback: T): T {
  if (isMissingWarehouseTableError(error)) return fallback
  throw error
}

function throwWarehouseWriteError(error: unknown): never {
  if (isMissingWarehouseTableError(error)) throw warehouseSetupError()
  throw error
}

function normalizeDriverMobile(input?: string): string | undefined {
  const digits = (input ?? "").replace(/\D/g, "")
  if (!digits) return undefined
  if (!/^\d{10}$/.test(digits)) {
    throw new Error("Driver mobile must be exactly 10 digits.")
  }
  return digits
}

// ── Warehouses ─────────────────────────────────────────────────

export async function listWarehouses(): Promise<Warehouse[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from('warehouses').select('*').order('created_at')
  if (error) return handleWarehouseReadError(error, [])
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    warehouseType: r.warehouse_type as Warehouse['warehouseType'],
    location: (r.location as string) ?? undefined,
    inChargeId: (r.in_charge_id as string) ?? undefined,
    stockCategory: ((r.stock_category as Warehouse['stockCategory']) ?? 'distribution') as Warehouse['stockCategory'],
    createdAt: r.created_at as string,
  }))
}

// ── Material Inward ────────────────────────────────────────────

function rowToInward(r: Record<string, unknown>): MaterialInward {
  return {
    id: r.id as string,
    warehouseId: (r.warehouse_id as string) ?? undefined,
    inwardDate: r.inward_date as string,
    poNumber: r.po_number as string,
    refNo: (r.ref_no as string) ?? undefined,
    supplierName: (r.supplier_name as string) ?? undefined,
    items: (r.items as WarehouseItem[]) ?? [],
    photoUrl: (r.photo_url as string) ?? undefined,
    photoGps: (r.photo_gps as MaterialInward['photoGps']) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    createdBy: (r.created_by as string) ?? undefined,
    createdAt: r.created_at as string,
  }
}

export async function listInwards(): Promise<MaterialInward[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from('material_inward').select('*').order('created_at', { ascending: false })
  if (error) return handleWarehouseReadError(error, [])
  return (data ?? []).map((r: any) => rowToInward(r as Record<string, unknown>))
}

export async function getInwardById(id: string): Promise<MaterialInward | undefined> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from('material_inward').select('*').eq('id', id).maybeSingle()
  if (error) return handleWarehouseReadError(error, undefined)
  return data ? rowToInward(data as Record<string, unknown>) : undefined
}

export async function deleteInward(id: string): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const existing = await getInwardById(id)
  const { error } = await q(sb).from('material_inward').delete().eq('id', id)
  if (error) throwWarehouseWriteError(error)
  try {
    await appendActivityLog({
      entityType: "warehouse_inward",
      entityId: id,
      action: "deleted",
      message: "Inward entry deleted",
      meta: {
        poNumber: existing?.poNumber,
      },
    })
  } catch {}
}

export async function createInward(input: Omit<MaterialInward, 'id' | 'createdAt'>): Promise<MaterialInward> {
  const sb = getSupabaseBrowserClient()

  const [defs, inwardRes, existingRes] = await Promise.all([
    listMaterialDefinitions(),
    q(sb).from("material_inward").select("id, items"),
    q(sb).from("material_inward").select("id").like("id", "INW-%"),
  ])
  if (inwardRes.error) throwWarehouseWriteError(inwardRes.error)
  if (existingRes.error) throwWarehouseWriteError(existingRes.error)

  const rules = definitionsByMaterialKey(defs)
  const inwardRowsRaw = inwardRes.data
  const existingSerials = collectExistingSerialsFromInwards(
    ((inwardRowsRaw ?? []) as Array<{ id: string; items?: WarehouseItem[] }>).map((r) => ({
      id: r.id,
      items: r.items ?? [],
    }))
  )
  validateInwardPayload(input.items, rules, existingSerials)

  const existing = existingRes.data
  let max = 0
  for (const r of (existing ?? []) as Array<{ id: string }>) {
    const m = /^INW-(\d+)$/.exec(r.id)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const id = `INW-${(max + 1).toString().padStart(3, '0')}`
  const row = {
    id,
    warehouse_id: input.warehouseId ?? null,
    inward_date: input.inwardDate,
    po_number: input.poNumber,
    ref_no: input.refNo ?? null,
    supplier_name: input.supplierName ?? null,
    items: input.items,
    photo_url: input.photoUrl ?? null,
    photo_gps: input.photoGps ?? null,
    notes: input.notes ?? null,
    created_by: input.createdBy ?? null,
  }
  const { data, error } = await q(sb).from('material_inward').insert(row).select().single()
  if (error) throwWarehouseWriteError(error)
  const created = rowToInward(data as Record<string, unknown>)
  try {
    await appendActivityLog({
      entityType: "warehouse_inward",
      entityId: created.id,
      action: "created",
      message: "Inward entry created",
      meta: {
        poNumber: created.poNumber,
        itemCount: created.items.length,
      },
    })
  } catch {}
  return created
}

export async function updateInward(
  id: string,
  input: Omit<MaterialInward, "id" | "createdAt">
): Promise<MaterialInward> {
  const sb = getSupabaseBrowserClient()

  const [defs, inwardRes] = await Promise.all([
    listMaterialDefinitions(),
    q(sb).from("material_inward").select("id, items"),
  ])
  if (inwardRes.error) throwWarehouseWriteError(inwardRes.error)
  const rules = definitionsByMaterialKey(defs)
  const inwardRowsRaw = inwardRes.data
  const existingSerials = collectExistingSerialsFromInwards(
    ((inwardRowsRaw ?? []) as Array<{ id: string; items?: WarehouseItem[] }>).map((r) => ({
      id: r.id,
      items: r.items ?? [],
    })),
    id
  )
  validateInwardPayload(input.items, rules, existingSerials)

  const previous = await getInwardById(id)
  const row = {
    warehouse_id: input.warehouseId ?? null,
    inward_date: input.inwardDate,
    po_number: input.poNumber,
    ref_no: input.refNo ?? null,
    supplier_name: input.supplierName ?? null,
    items: input.items,
    photo_url: input.photoUrl ?? null,
    photo_gps: input.photoGps ?? null,
    notes: input.notes ?? null,
    created_by: input.createdBy ?? null,
  }
  const { data, error } = await q(sb).from("material_inward").update(row).eq("id", id).select().single()
  if (error) throwWarehouseWriteError(error)
  const updated = rowToInward(data as Record<string, unknown>)
  const changedFields: string[] = []
  if (previous) {
    if (previous.inwardDate !== updated.inwardDate) changedFields.push("inwardDate")
    if (previous.poNumber !== updated.poNumber) changedFields.push("poNumber")
    if ((previous.refNo ?? "") !== (updated.refNo ?? "")) changedFields.push("refNo")
    if ((previous.supplierName ?? "") !== (updated.supplierName ?? "")) changedFields.push("supplierName")
    if ((previous.notes ?? "") !== (updated.notes ?? "")) changedFields.push("notes")
    if (JSON.stringify(previous.items ?? []) !== JSON.stringify(updated.items ?? [])) changedFields.push("items")
  }
  try {
    await appendActivityLog({
      entityType: "warehouse_inward",
      entityId: updated.id,
      action: "updated",
      message: "Inward entry updated",
      meta: { changedFields },
    })
  } catch {}
  return updated
}

// ── Material Dispatch ──────────────────────────────────────────

function rowToDispatch(r: Record<string, unknown>): MaterialDispatch {
  return {
    id: r.id as string,
    fromWarehouseId: (r.from_warehouse_id as string) ?? undefined,
    toWarehouseId: (r.to_warehouse_id as string) ?? undefined,
    dcNumber: r.dc_number as string,
    dispatchDate: r.dispatch_date as string,
    vehicleNo: (r.vehicle_no as string) ?? undefined,
    driverName: (r.driver_name as string) ?? undefined,
    driverMobile: (r.driver_mobile as string) ?? undefined,
    vehicleType: (r.vehicle_type as string) ?? undefined,
    fromLocation: (r.from_location as string) ?? undefined,
    toLocation: (r.to_location as string) ?? undefined,
    dispatchedBy: (r.dispatched_by as string) ?? undefined,
    items: (r.items as WarehouseItem[]) ?? [],
    notes: (r.notes as string) ?? undefined,
    status: (r.status as MaterialDispatch['status']) ?? 'dispatched',
    createdAt: r.created_at as string,
  }
}

export async function listDispatches(): Promise<MaterialDispatch[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from('material_dispatch').select('*').order('created_at', { ascending: false })
  if (error) return handleWarehouseReadError(error, [])
  return (data ?? []).map(rowToDispatch)
}

export async function getDispatchById(id: string): Promise<MaterialDispatch | undefined> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from('material_dispatch').select('*').eq('id', id).maybeSingle()
  if (error) return handleWarehouseReadError(error, undefined)
  return data ? rowToDispatch(data as Record<string, unknown>) : undefined
}

export async function createDispatch(input: Omit<MaterialDispatch, 'id' | 'createdAt'>): Promise<MaterialDispatch> {
  const sb = getSupabaseBrowserClient()
  const driverMobile = normalizeDriverMobile(input.driverMobile)

  const requestedItems = input.items.filter((item) => (item.serialNos ?? []).length > 0)
  if (requestedItems.length > 0) {
    const [inwards, dispatches, returns, supplierRmas] = await Promise.all([
      listInwards(),
      listDispatches(),
      listReturns(),
      listSupplierReturns(),
    ])

    const inwardPick = inwards.map((r) => ({ items: r.items }))
    const dispatchPick = dispatches.map((r) => ({ items: r.items }))
    const returnPick = returns.map((r) => ({ items: r.items }))
    const supplierPick = supplierRmas.map((r) => ({ items: r.items }))

    if (input.fromWarehouseId) {
      assertDispatchSerialsForWarehouse(
        input.fromWarehouseId,
        input.items,
        inwards,
        dispatches,
        returns,
        supplierRmas.map((r) => ({ fromWarehouseId: r.fromWarehouseId, items: r.items }))
      )
    } else {
      assertDispatchSerialsGlobally(input.items, inwardPick, dispatchPick, returnPick, supplierPick)
    }
  }

  const { data: existing, error: existingError } = await q(sb).from('material_dispatch').select('id').like('id', 'DC-%')
  if (existingError) throwWarehouseWriteError(existingError)
  let max = 0
  for (const r of existing ?? []) {
    const m = /^DC-(\d+)$/.exec(r.id as string)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const nextDcNumber = `DC-${(max + 1).toString().padStart(3, '0')}`
  const id = nextDcNumber
  const row = {
    id,
    from_warehouse_id: input.fromWarehouseId ?? null,
    to_warehouse_id: input.toWarehouseId ?? null,
    dc_number: nextDcNumber,
    dispatch_date: input.dispatchDate,
    vehicle_no: input.vehicleNo ?? null,
    driver_name: input.driverName ?? null,
    driver_mobile: driverMobile ?? null,
    vehicle_type: input.vehicleType ?? null,
    from_location: input.fromLocation ?? null,
    to_location: input.toLocation ?? null,
    dispatched_by: input.dispatchedBy ?? null,
    items: input.items,
    notes: input.notes ?? null,
    status: input.status,
  }
  const { data, error } = await q(sb).from('material_dispatch').insert(row).select().single()
  if (error) throwWarehouseWriteError(error)
  const created = rowToDispatch(data as Record<string, unknown>)
  try {
    await appendActivityLog({
      entityType: "warehouse_dispatch",
      entityId: created.id,
      action: "created",
      message: "Dispatch created",
      meta: {
        dcNumber: created.dcNumber,
        itemCount: created.items.length,
        status: created.status,
      },
    })
  } catch {}
  return created
}

export async function updateDispatchStatus(id: string, status: MaterialDispatch['status']): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const { error } = await q(sb).from('material_dispatch').update({ status }).eq('id', id)
  if (error) throwWarehouseWriteError(error)
}

export async function updateDispatch(
  id: string,
  input: Omit<MaterialDispatch, "id" | "createdAt">
): Promise<MaterialDispatch> {
  const sb = getSupabaseBrowserClient()
  const previous = await getDispatchById(id)
  const driverMobile = normalizeDriverMobile(input.driverMobile)

  const requestedItems = input.items.filter((item) => (item.serialNos ?? []).length > 0)
  if (requestedItems.length > 0) {
    const [inwards, dispatches, returns, supplierRmas] = await Promise.all([
      listInwards(),
      listDispatches(),
      listReturns(),
      listSupplierReturns(),
    ])
    const dispatchesFiltered = dispatches.filter((d) => d.id !== id)
    const inwardPick = inwards.map((r) => ({ items: r.items }))
    const dispatchPick = dispatchesFiltered.map((r) => ({ items: r.items }))
    const returnPick = returns.map((r) => ({ items: r.items }))
    const supplierPick = supplierRmas.map((r) => ({ items: r.items }))
    if (input.fromWarehouseId) {
      assertDispatchSerialsForWarehouse(
        input.fromWarehouseId,
        input.items,
        inwards,
        dispatchesFiltered,
        returns,
        supplierRmas.map((r) => ({ fromWarehouseId: r.fromWarehouseId, items: r.items }))
      )
    } else {
      assertDispatchSerialsGlobally(input.items, inwardPick, dispatchPick, returnPick, supplierPick)
    }
  }

  const row = {
    from_warehouse_id: input.fromWarehouseId ?? null,
    to_warehouse_id: input.toWarehouseId ?? null,
    dc_number: input.dcNumber,
    dispatch_date: input.dispatchDate,
    vehicle_no: input.vehicleNo ?? null,
    driver_name: input.driverName ?? null,
    driver_mobile: driverMobile ?? null,
    vehicle_type: input.vehicleType ?? null,
    from_location: input.fromLocation ?? null,
    to_location: input.toLocation ?? null,
    dispatched_by: input.dispatchedBy ?? null,
    items: input.items,
    notes: input.notes ?? null,
    status: input.status,
  }
  const { data, error } = await q(sb).from("material_dispatch").update(row).eq("id", id).select().single()
  if (error) throwWarehouseWriteError(error)
  const updated = rowToDispatch(data as Record<string, unknown>)
  const changedFields: string[] = []
  if (previous) {
    if (previous.dispatchDate !== updated.dispatchDate) changedFields.push("dispatchDate")
    if ((previous.vehicleNo ?? "") !== (updated.vehicleNo ?? "")) changedFields.push("vehicleNo")
    if ((previous.driverName ?? "") !== (updated.driverName ?? "")) changedFields.push("driverName")
    if ((previous.driverMobile ?? "") !== (updated.driverMobile ?? "")) changedFields.push("driverMobile")
    if ((previous.vehicleType ?? "") !== (updated.vehicleType ?? "")) changedFields.push("vehicleType")
    if ((previous.fromLocation ?? "") !== (updated.fromLocation ?? "")) changedFields.push("fromLocation")
    if ((previous.toLocation ?? "") !== (updated.toLocation ?? "")) changedFields.push("toLocation")
    if ((previous.notes ?? "") !== (updated.notes ?? "")) changedFields.push("notes")
    if (previous.status !== updated.status) changedFields.push("status")
    if (JSON.stringify(previous.items ?? []) !== JSON.stringify(updated.items ?? [])) changedFields.push("items")
  }
  try {
    await appendActivityLog({
      entityType: "warehouse_dispatch",
      entityId: updated.id,
      action: "updated",
      message: "Dispatch updated",
      meta: { changedFields },
    })
  } catch {}
  return updated
}

/**
 * Remove a dispatch challan. Blocked when a material receipt or household delivery
 * still references this DC (receipt: DB FK; deliveries: data integrity).
 */
export async function deleteDispatch(id: string): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const existing = await getDispatchById(id)
  if (!existing) {
    throw new Error("Dispatch not found")
  }

  const { count: receiptCount, error: receiptErr } = await q(sb)
    .from("material_receipt")
    .select("id", { count: "exact", head: true })
    .eq("dispatch_id", id)
  if (receiptErr) throwWarehouseWriteError(receiptErr)
  if ((receiptCount ?? 0) > 0) {
    throw new Error(
      "Cannot delete this dispatch: a material receipt is recorded for it. Remove the receipt entry first."
    )
  }

  const { count: deliveryCount, error: deliveryErr } = await q(sb)
    .from("house_material_delivery")
    .select("id", { count: "exact", head: true })
    .eq("dispatch_id", id)
  if (deliveryErr) throwWarehouseWriteError(deliveryErr)
  if ((deliveryCount ?? 0) > 0) {
    throw new Error(
      "Cannot delete this dispatch: household material deliveries are still linked to it. Reassign or remove those deliveries first."
    )
  }

  const { error } = await q(sb).from("material_dispatch").delete().eq("id", id)
  if (error) throwWarehouseWriteError(error)
  try {
    await appendActivityLog({
      entityType: "warehouse_dispatch",
      entityId: id,
      action: "deleted",
      message: "Dispatch deleted",
      meta: { dcNumber: existing.dcNumber },
    })
  } catch {}
}

// ── Material Receipt ───────────────────────────────────────────

export async function createReceipt(input: Omit<MaterialReceipt, 'id' | 'createdAt'>): Promise<MaterialReceipt> {
  const sb = getSupabaseBrowserClient()
  const { data: existing, error: existingError } = await q(sb).from('material_receipt').select('id').like('id', 'RCP-%')
  if (existingError) throwWarehouseWriteError(existingError)
  let max = 0
  for (const r of existing ?? []) {
    const m = /^RCP-(\d+)$/.exec(r.id as string)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const id = `RCP-${(max + 1).toString().padStart(3, '0')}`
  const row = {
    id,
    dispatch_id: input.dispatchId,
    received_by: input.receivedBy ?? null,
    received_date: input.receivedDate,
    receipt_status: input.receiptStatus,
    items_received: input.itemsReceived,
    shortage_notes: input.shortageNotes ?? null,
  }
  const { data, error } = await q(sb).from('material_receipt').insert(row).select().single()
  if (error) throwWarehouseWriteError(error)
  // Mark dispatch as received
  await updateDispatchStatus(input.dispatchId, 'received')
  const r = data as Record<string, unknown>
  return {
    id: r.id as string,
    dispatchId: r.dispatch_id as string,
    receivedBy: (r.received_by as string) ?? undefined,
    receivedDate: r.received_date as string,
    receiptStatus: r.receipt_status as MaterialReceipt['receiptStatus'],
    itemsReceived: (r.items_received as WarehouseItem[]) ?? [],
    shortageNotes: (r.shortage_notes as string) ?? undefined,
    createdAt: r.created_at as string,
  }
}

export async function listReceipts(): Promise<MaterialReceipt[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from('material_receipt').select('*').order('created_at', { ascending: false })
  if (error) return handleWarehouseReadError(error, [])
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    dispatchId: r.dispatch_id as string,
    receivedBy: (r.received_by as string) ?? undefined,
    receivedDate: r.received_date as string,
    receiptStatus: r.receipt_status as MaterialReceipt['receiptStatus'],
    itemsReceived: (r.items_received as WarehouseItem[]) ?? [],
    shortageNotes: (r.shortage_notes as string) ?? undefined,
    createdAt: r.created_at as string,
  }))
}

// ── Village Issues ─────────────────────────────────────────────

function rowToVillageIssue(r: Record<string, unknown>): MaterialIssueVillage {
  return {
    id: r.id as string,
    projectId: (r.project_id as string) ?? undefined,
    fromWarehouseId: (r.from_warehouse_id as string) ?? undefined,
    mandal: r.mandal as string,
    villageName: r.village_name as string,
    householdsApproved: (r.households_approved as number) ?? 0,
    issueChallanNo: r.issue_challan_no as string,
    issueDate: r.issue_date as string,
    issuedBy: (r.issued_by as string) ?? undefined,
    items: (r.items as VillageIssueItem[]) ?? [],
    notes: (r.notes as string) ?? undefined,
    createdAt: r.created_at as string,
  }
}

export async function listVillageIssues(): Promise<MaterialIssueVillage[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from('material_issue_village').select('*').order('created_at', { ascending: false })
  if (error) return handleWarehouseReadError(error, [])
  return (data ?? []).map((r: any) => rowToVillageIssue(r as Record<string, unknown>))
}

export async function createVillageIssue(input: Omit<MaterialIssueVillage, 'id' | 'createdAt'>): Promise<MaterialIssueVillage> {
  const sb = getSupabaseBrowserClient()
  const normalize = (name: string) => name.trim().toLowerCase()
  const requestedByName = new Map<string, number>()
  for (const item of input.items) {
    const key = normalize(item.name)
    requestedByName.set(key, (requestedByName.get(key) ?? 0) + (item.totalQty ?? 0))
  }

  const [inwardRes, priorIssueRes, returnRes] = await Promise.all([
    q(sb).from('material_inward').select('items'),
    q(sb).from('material_issue_village').select('items'),
    q(sb).from('material_returns').select('items'),
  ])
  if (inwardRes.error) throwWarehouseWriteError(inwardRes.error)
  if (priorIssueRes.error) throwWarehouseWriteError(priorIssueRes.error)
  if (returnRes.error) throwWarehouseWriteError(returnRes.error)

  const inwardItems = ((inwardRes.data ?? []) as Array<Record<string, unknown>>)
    .flatMap((r) => (r.items as WarehouseItem[]) ?? [])
  const issuedItems = ((priorIssueRes.data ?? []) as Array<Record<string, unknown>>)
    .flatMap((r) => (r.items as VillageIssueItem[]) ?? [])
  const returnedItems = ((returnRes.data ?? []) as Array<Record<string, unknown>>)
    .flatMap((r) => (r.items as WarehouseItem[]) ?? [])

  const inwardByName = new Map<string, number>()
  const issuedByName = new Map<string, number>()
  const returnedByName = new Map<string, number>()

  for (const item of inwardItems) {
    const key = normalize(item.name)
    inwardByName.set(key, (inwardByName.get(key) ?? 0) + (item.qty ?? 0))
  }
  for (const item of issuedItems) {
    const key = normalize(item.name)
    issuedByName.set(key, (issuedByName.get(key) ?? 0) + (item.totalQty ?? 0))
  }
  for (const item of returnedItems) {
    const key = normalize(item.name)
    returnedByName.set(key, (returnedByName.get(key) ?? 0) + (item.qty ?? 0))
  }

  for (const [key, requested] of requestedByName) {
    const available = (inwardByName.get(key) ?? 0) - (issuedByName.get(key) ?? 0) + (returnedByName.get(key) ?? 0)
    if (requested > available) {
      const requestedName = input.items.find((x) => normalize(x.name) === key)?.name ?? key
      throw new Error(
        `Insufficient stock for ${requestedName}. Available: ${available}, requested: ${requested}.`
      )
    }
  }

  const inwardPanelSerials = new Set(
    inwardItems
      .filter((x) => normalize(x.name) === normalize('Solar PV Module'))
      .flatMap((x) => x.serialNos ?? [])
      .map((s) => s.trim())
      .filter(Boolean)
  )
  const alreadyIssuedPanelSerials = new Set(
    issuedItems
      .filter((x) => normalize(x.name) === normalize('Solar PV Module'))
      .flatMap((x) => x.serialNos ?? [])
      .map((s) => s.trim())
      .filter(Boolean)
  )
  const requestedPanel = input.items.find((x) => normalize(x.name) === normalize('Solar PV Module'))
  if (requestedPanel?.serialNos && requestedPanel.serialNos.length > 0) {
    if (requestedPanel.serialNos.length !== requestedPanel.totalQty) {
      throw new Error("Solar PV Module serial count must match total quantity.")
    }
    const seen = new Set<string>()
    for (const raw of requestedPanel.serialNos) {
      const serial = raw.trim()
      if (!serial) continue
      if (seen.has(serial)) throw new Error(`Duplicate serial in upload: ${serial}`)
      seen.add(serial)
      if (!inwardPanelSerials.has(serial)) throw new Error(`Serial not found in inward stock: ${serial}`)
      if (alreadyIssuedPanelSerials.has(serial)) throw new Error(`Serial already issued earlier: ${serial}`)
    }
  }

  const { data: existing, error: existingError } = await q(sb).from('material_issue_village').select('id').like('id', 'VIS-%')
  if (existingError) throwWarehouseWriteError(existingError)
  let max = 0
  for (const r of existing ?? []) {
    const m = /^VIS-(\d+)$/.exec(r.id as string)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const id = `VIS-${(max + 1).toString().padStart(3, '0')}`
  const row = {
    id,
    project_id: input.projectId ?? null,
    from_warehouse_id: input.fromWarehouseId ?? null,
    mandal: input.mandal,
    village_name: input.villageName,
    households_approved: input.householdsApproved,
    issue_challan_no: input.issueChallanNo,
    issue_date: input.issueDate,
    issued_by: input.issuedBy ?? null,
    items: input.items,
    notes: input.notes ?? null,
  }
  const { data, error } = await q(sb).from('material_issue_village').insert(row).select().single()
  if (error) throwWarehouseWriteError(error)
  return rowToVillageIssue(data as Record<string, unknown>)
}

// ── Village Allotments ─────────────────────────────────────────

export async function listAllotments(): Promise<VillageAllotment[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from('village_allotments').select('*').order('created_at', { ascending: false })
  if (error) return handleWarehouseReadError(error, [])
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    projectId: (r.project_id as string) ?? undefined,
    mandal: r.mandal as string,
    villageName: r.village_name as string,
    engineerId: (r.engineer_id as string) ?? undefined,
    householdsAllotted: (r.households_allotted as number) ?? undefined,
    allottedDate: (r.allotted_date as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    createdAt: r.created_at as string,
  }))
}

export async function createAllotment(input: Omit<VillageAllotment, 'id' | 'createdAt'>): Promise<VillageAllotment> {
  const sb = getSupabaseBrowserClient()
  const { data: existing, error: existingError } = await q(sb).from('village_allotments').select('id').like('id', 'ALT-%')
  if (existingError) throwWarehouseWriteError(existingError)
  let max = 0
  for (const r of existing ?? []) {
    const m = /^ALT-(\d+)$/.exec(r.id as string)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const id = `ALT-${(max + 1).toString().padStart(3, '0')}`
  const row = {
    id,
    project_id: input.projectId ?? null,
    mandal: input.mandal,
    village_name: input.villageName,
    engineer_id: input.engineerId ?? null,
    households_allotted: input.householdsAllotted ?? null,
    allotted_date: input.allottedDate ?? null,
    notes: input.notes ?? null,
  }
  const { data, error } = await q(sb).from('village_allotments').insert(row).select().single()
  if (error) throwWarehouseWriteError(error)
  const r = data as Record<string, unknown>
  return {
    id: r.id as string,
    projectId: (r.project_id as string) ?? undefined,
    mandal: r.mandal as string,
    villageName: r.village_name as string,
    engineerId: (r.engineer_id as string) ?? undefined,
    householdsAllotted: (r.households_allotted as number) ?? undefined,
    allottedDate: (r.allotted_date as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    createdAt: r.created_at as string,
  }
}

// ── Material Returns ───────────────────────────────────────────

export async function listReturns(): Promise<MaterialReturn[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from('material_returns').select('*').order('created_at', { ascending: false })
  if (error) return handleWarehouseReadError(error, [])
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    projectId: (r.project_id as string) ?? undefined,
    fromVillage: (r.from_village as string) ?? undefined,
    toWarehouseId: (r.to_warehouse_id as string) ?? undefined,
    returnDate: r.return_date as string,
    returnReason: r.return_reason as MaterialReturn['returnReason'],
    returnedBy: (r.returned_by as string) ?? undefined,
    items: (r.items as WarehouseItem[]) ?? [],
    notes: (r.notes as string) ?? undefined,
    createdAt: r.created_at as string,
  }))
}

function rowToSupplierRma(r: Record<string, unknown>): SupplierMaterialReturn {
  return {
    id: r.id as string,
    fromWarehouseId: (r.from_warehouse_id as string) ?? undefined,
    poNumber: r.po_number as string,
    supplierName: (r.supplier_name as string) ?? undefined,
    returnDate: r.return_date as string,
    status: (r.status as SupplierMaterialReturn["status"]) ?? "draft",
    items: (r.items as WarehouseItem[]) ?? [],
    notes: (r.notes as string) ?? undefined,
    createdBy: (r.created_by as string) ?? undefined,
    createdAt: r.created_at as string,
  }
}

export async function listSupplierReturns(): Promise<SupplierMaterialReturn[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb)
    .from("supplier_material_returns")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return handleWarehouseReadError(error, [])
  return ((data ?? []) as Record<string, unknown>[]).map(rowToSupplierRma)
}

export async function createSupplierReturn(
  input: Omit<SupplierMaterialReturn, "id" | "createdAt">
): Promise<SupplierMaterialReturn> {
  const sb = getSupabaseBrowserClient()
  if (!input.fromWarehouseId) {
    throw new Error("Source warehouse is required to record a supplier RMA.")
  }

  const serialLines = input.items.filter((i) => (i.serialNos ?? []).some((s) => s.trim()))
  if (serialLines.length > 0) {
    const [inwards, dispatches, returns, supplierRmas] = await Promise.all([
      listInwards(),
      listDispatches(),
      listReturns(),
      listSupplierReturns(),
    ])
    const avail = buildAvailableSerialsAtWarehouse(
      input.fromWarehouseId,
      inwards,
      dispatches,
      returns,
      supplierRmas.map((r) => ({ fromWarehouseId: r.fromWarehouseId, items: r.items }))
    )
    for (const item of serialLines) {
      const mat = normalizeMaterial(item.name)
      const bag = avail.get(mat) ?? new Set<string>()
      const seen = new Set<string>()
      for (const raw of item.serialNos ?? []) {
        const sn = normalizeSerial(raw)
        if (!sn) continue
        if (seen.has(sn)) throw new Error(`Duplicate serial in supplier RMA for ${item.name}: ${raw}`)
        seen.add(sn)
        if (!bag.has(sn)) {
          throw new Error(`Serial not available at selected warehouse for supplier return (${item.name}): ${raw}`)
        }
        bag.delete(sn)
      }
    }
  }

  const { data: existing, error: existingError } = await q(sb).from("supplier_material_returns").select("id").like("id", "RMA-%")
  if (existingError) throwWarehouseWriteError(existingError)
  let max = 0
  for (const r of existing ?? []) {
    const m = /^RMA-(\d+)$/.exec(r.id as string)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const id = `RMA-${(max + 1).toString().padStart(3, "0")}`
  const row = {
    id,
    from_warehouse_id: input.fromWarehouseId ?? null,
    po_number: input.poNumber,
    supplier_name: input.supplierName ?? null,
    return_date: input.returnDate,
    status: input.status,
    items: input.items,
    notes: input.notes ?? null,
    created_by: input.createdBy ?? null,
  }
  const { data, error } = await q(sb).from("supplier_material_returns").insert(row).select().single()
  if (error) throwWarehouseWriteError(error)
  const created = rowToSupplierRma(data as Record<string, unknown>)
  try {
    await appendActivityLog({
      entityType: "warehouse_supplier_rma",
      entityId: created.id,
      action: "created",
      message: "Supplier RMA recorded",
      meta: { poNumber: created.poNumber, itemCount: created.items.length },
    })
  } catch {}
  return created
}

export async function getReturnById(id: string): Promise<MaterialReturn | undefined> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from("material_returns").select("*").eq("id", id).maybeSingle()
  if (error) return handleWarehouseReadError(error, undefined)
  if (!data) return undefined
  const r = data as Record<string, unknown>
  return {
    id: r.id as string,
    projectId: (r.project_id as string) ?? undefined,
    fromVillage: (r.from_village as string) ?? undefined,
    toWarehouseId: (r.to_warehouse_id as string) ?? undefined,
    returnDate: r.return_date as string,
    returnReason: r.return_reason as MaterialReturn["returnReason"],
    returnedBy: (r.returned_by as string) ?? undefined,
    items: (r.items as WarehouseItem[]) ?? [],
    notes: (r.notes as string) ?? undefined,
    createdAt: r.created_at as string,
  }
}

export async function createReturn(input: Omit<MaterialReturn, 'id' | 'createdAt'>): Promise<MaterialReturn> {
  const sb = getSupabaseBrowserClient()

  const [inwards, dispatches, returns] = await Promise.all([listInwards(), listDispatches(), listReturns()])
  assertFieldReturnSerialsForUpsert(
    undefined,
    input.items,
    inwards.map((r) => ({ items: r.items })),
    dispatches.map((r) => ({ items: r.items })),
    returns.map((r) => ({ id: r.id, items: r.items ?? [] }))
  )

  const { data: existing, error: existingError } = await q(sb).from('material_returns').select('id').like('id', 'RET-%')
  if (existingError) throwWarehouseWriteError(existingError)
  let max = 0
  for (const r of existing ?? []) {
    const m = /^RET-(\d+)$/.exec(r.id as string)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const id = `RET-${(max + 1).toString().padStart(3, '0')}`
  const row = {
    id,
    project_id: input.projectId ?? null,
    from_village: input.fromVillage ?? null,
    to_warehouse_id: input.toWarehouseId ?? null,
    return_date: input.returnDate,
    return_reason: input.returnReason,
    returned_by: input.returnedBy ?? null,
    items: input.items,
    notes: input.notes ?? null,
  }
  const { data, error } = await q(sb).from('material_returns').insert(row).select().single()
  if (error) throwWarehouseWriteError(error)
  const r = data as Record<string, unknown>
  const created = {
    id: r.id as string,
    projectId: (r.project_id as string) ?? undefined,
    fromVillage: (r.from_village as string) ?? undefined,
    toWarehouseId: (r.to_warehouse_id as string) ?? undefined,
    returnDate: r.return_date as string,
    returnReason: r.return_reason as MaterialReturn['returnReason'],
    returnedBy: (r.returned_by as string) ?? undefined,
    items: (r.items as WarehouseItem[]) ?? [],
    notes: (r.notes as string) ?? undefined,
    createdAt: r.created_at as string,
  }
  try {
    await appendActivityLog({
      entityType: "warehouse_return",
      entityId: created.id,
      action: "created",
      message: "Material return recorded",
      meta: {
        returnReason: created.returnReason,
        itemCount: created.items.length,
      },
    })
  } catch {}
  return created
}

export async function updateReturn(
  id: string,
  input: Omit<MaterialReturn, "id" | "createdAt">
): Promise<MaterialReturn> {
  const sb = getSupabaseBrowserClient()
  const previous = await getReturnById(id)
  if (!previous) throw new Error("Return record not found.")

  const [inwards, dispatches, returns] = await Promise.all([listInwards(), listDispatches(), listReturns()])
  assertFieldReturnSerialsForUpsert(
    id,
    input.items,
    inwards.map((r) => ({ items: r.items })),
    dispatches.map((r) => ({ items: r.items })),
    returns.map((r) => ({ id: r.id, items: r.items ?? [] }))
  )

  const row = {
    project_id: input.projectId ?? null,
    from_village: input.fromVillage ?? null,
    to_warehouse_id: input.toWarehouseId ?? null,
    return_date: input.returnDate,
    return_reason: input.returnReason,
    returned_by: input.returnedBy ?? null,
    items: input.items,
    notes: input.notes ?? null,
  }
  const { data, error } = await q(sb).from("material_returns").update(row).eq("id", id).select().single()
  if (error) throwWarehouseWriteError(error)
  const r = data as Record<string, unknown>
  const updated: MaterialReturn = {
    id: r.id as string,
    projectId: (r.project_id as string) ?? undefined,
    fromVillage: (r.from_village as string) ?? undefined,
    toWarehouseId: (r.to_warehouse_id as string) ?? undefined,
    returnDate: r.return_date as string,
    returnReason: r.return_reason as MaterialReturn["returnReason"],
    returnedBy: (r.returned_by as string) ?? undefined,
    items: (r.items as WarehouseItem[]) ?? [],
    notes: (r.notes as string) ?? undefined,
    createdAt: r.created_at as string,
  }
  const changedFields: string[] = []
  if (previous.returnDate !== updated.returnDate) changedFields.push("returnDate")
  if ((previous.fromVillage ?? "") !== (updated.fromVillage ?? "")) changedFields.push("fromVillage")
  if ((previous.toWarehouseId ?? "") !== (updated.toWarehouseId ?? "")) changedFields.push("toWarehouseId")
  if (previous.returnReason !== updated.returnReason) changedFields.push("returnReason")
  if ((previous.notes ?? "") !== (updated.notes ?? "")) changedFields.push("notes")
  if (JSON.stringify(previous.items ?? []) !== JSON.stringify(updated.items ?? [])) changedFields.push("items")
  try {
    await appendActivityLog({
      entityType: "warehouse_return",
      entityId: updated.id,
      action: "updated",
      message: "Material return updated",
      meta: { changedFields },
    })
  } catch {}
  return updated
}

export async function deleteReturn(id: string): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const existing = await getReturnById(id)
  const { error } = await q(sb).from("material_returns").delete().eq("id", id)
  if (error) throwWarehouseWriteError(error)
  try {
    await appendActivityLog({
      entityType: "warehouse_return",
      entityId: id,
      action: "deleted",
      message: "Material return deleted",
      meta: { returnReason: existing?.returnReason },
    })
  } catch {}
}

// ── House Delivery / Reallocation ──────────────────────────────

function rowToHouseMaterialDelivery(r: Record<string, unknown>): HouseMaterialDelivery {
  return {
    id: r.id as string,
    allocationBatchId: (r.allocation_batch_id as string) ?? undefined,
    dispatchId: (r.dispatch_id as string) ?? undefined,
    fromEntityType: ((r.from_entity_type as string) ?? "warehouse") as HouseMaterialDelivery["fromEntityType"],
    fromEntityId: (r.from_entity_id as string) ?? undefined,
    toHouseholdId: r.to_household_id as string,
    materialName: r.material_name as string,
    qty: Number(r.qty ?? 0),
    unit: (r.unit as string) ?? undefined,
    serialNos: (r.serial_nos as string[]) ?? [],
    status: ((r.status as string) ?? "allocated") as HouseMaterialDelivery["status"],
    proofPhotoUrl: (r.proof_photo_url as string) ?? undefined,
    proofPhotoGps: (r.proof_photo_gps as HouseMaterialDelivery["proofPhotoGps"]) ?? undefined,
    deliveredBy: (r.delivered_by as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    installedRefId: (r.installed_ref_id as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: (r.updated_at as string) ?? undefined,
  }
}

function normalizeSerial(raw: string): string {
  return raw.trim().toLowerCase()
}

async function assertHouseAllocationSerialsAvailable(materialName: string, serialNos: string[]): Promise<void> {
  if (serialNos.length === 0) return
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb)
    .from("house_material_delivery")
    .select("id, status, serial_nos")
    .ilike("material_name", materialName)
    .neq("status", "returned")
  if (error) throwWarehouseWriteError(error)

  const requested = new Set(serialNos.map(normalizeSerial))
  const conflicts: string[] = []
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const status = String(row.status ?? "").toLowerCase()
    if (status === "returned") continue
    for (const s of ((row.serial_nos as string[]) ?? [])) {
      const n = normalizeSerial(s)
      if (requested.has(n)) conflicts.push(s)
    }
  }
  if (conflicts.length > 0) {
    throw new Error(`Serial(s) already allocated: ${[...new Set(conflicts)].join(", ")}`)
  }
}

function rowToHouseMovementEvent(r: Record<string, unknown>): HouseMaterialMovementEvent {
  return {
    id: r.id as string,
    deliveryId: (r.delivery_id as string) ?? undefined,
    eventType: ((r.event_type as string) ?? "allocate") as HouseMaterialMovementEvent["eventType"],
    fromHouseholdId: (r.from_household_id as string) ?? undefined,
    toHouseholdId: (r.to_household_id as string) ?? undefined,
    materialName: r.material_name as string,
    serialNos: (r.serial_nos as string[]) ?? [],
    qty: Number(r.qty ?? 0),
    proofPhotoUrl: (r.proof_photo_url as string) ?? undefined,
    proofPhotoGps: (r.proof_photo_gps as HouseMaterialMovementEvent["proofPhotoGps"]) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    actorId: (r.actor_id as string) ?? undefined,
    approvalStatus: (r.approval_status as HouseMaterialMovementEvent["approvalStatus"]) ?? undefined,
    approvedBy: (r.approved_by as string) ?? undefined,
    approvedAt: (r.approved_at as string) ?? undefined,
    requestPayload: (r.request_payload as Record<string, unknown>) ?? undefined,
    rejectionReason: (r.rejection_reason as string) ?? undefined,
    createdAt: r.created_at as string,
  }
}

async function nextIdByPrefix(table: string, prefix: string, width = 4): Promise<string> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from(table).select("id").like("id", `${prefix}%`)
  if (error) throwWarehouseWriteError(error)
  let max = 0
  for (const r of data ?? []) {
    const m = new RegExp(`^${prefix}(\\d+)$`).exec(r.id as string)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}${(max + 1).toString().padStart(width, "0")}`
}

export async function createHouseDeliveryAllocation(input: {
  allocationBatchId?: string
  dispatchId?: string
  fromEntityType?: HouseMaterialDelivery["fromEntityType"]
  fromEntityId?: string
  toHouseholdId: string
  materialName: string
  qty: number
  unit?: string
  serialNos?: string[]
  notes?: string
  proofPhotoUrl?: string
  proofPhotoGps?: HouseMaterialDelivery["proofPhotoGps"]
}): Promise<HouseMaterialDelivery> {
  const sb = getSupabaseBrowserClient()
  const id = await nextIdByPrefix("house_material_delivery", "HDL-")
  const serialNos = [...new Set((input.serialNos ?? []).map((s) => s.trim()).filter(Boolean))]
  await assertHouseAllocationSerialsAvailable(input.materialName, serialNos)
  const row = {
    id,
    allocation_batch_id: input.allocationBatchId ?? null,
    dispatch_id: input.dispatchId ?? null,
    from_entity_type: input.fromEntityType ?? "warehouse",
    from_entity_id: input.fromEntityId ?? null,
    to_household_id: input.toHouseholdId,
    material_name: input.materialName,
    qty: input.qty,
    unit: input.unit ?? null,
    serial_nos: serialNos,
    status: "allocated",
    proof_photo_url: input.proofPhotoUrl ?? null,
    proof_photo_gps: input.proofPhotoGps ?? null,
    notes: input.notes ?? null,
  }
  const { data, error } = await q(sb).from("house_material_delivery").insert(row).select().single()
  if (error) throwWarehouseWriteError(error)
  const saved = rowToHouseMaterialDelivery(data as Record<string, unknown>)
  try {
    await appendActivityLog({
      entityType: "warehouse_allocation",
      entityId: saved.id,
      action: "created",
      message: "Allocation created",
      meta: {
        toHouseholdId: saved.toHouseholdId,
        materialName: saved.materialName,
        qty: saved.qty,
      },
    })
  } catch {}

  const eventId = await nextIdByPrefix("house_material_movement_events", "HME-")
  const { error: eventError } = await q(sb).from("house_material_movement_events").insert({
    id: eventId,
    delivery_id: saved.id,
    event_type: "allocate",
    from_household_id: input.fromEntityType === "household" ? input.fromEntityId ?? null : null,
    to_household_id: saved.toHouseholdId,
    material_name: saved.materialName,
    serial_nos: saved.serialNos,
    qty: saved.qty,
    proof_photo_url: saved.proofPhotoUrl ?? null,
    proof_photo_gps: saved.proofPhotoGps ?? null,
    notes: saved.notes ?? null,
  })
  if (eventError) throwWarehouseWriteError(eventError)
  return saved
}

export async function listHouseDeliveries(): Promise<HouseMaterialDelivery[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from("house_material_delivery").select("*").order("created_at", { ascending: false })
  if (error) return handleWarehouseReadError(error, [])
  return ((data ?? []) as Array<Record<string, unknown>>).map(rowToHouseMaterialDelivery)
}

export async function getHouseDeliveryById(id: string): Promise<HouseMaterialDelivery | undefined> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from("house_material_delivery").select("*").eq("id", id).maybeSingle()
  if (error) return handleWarehouseReadError(error, undefined)
  return data ? rowToHouseMaterialDelivery(data as Record<string, unknown>) : undefined
}

export async function updateHouseDelivery(
  id: string,
  input: {
    toHouseholdId: string
    materialName: string
    qty: number
    unit?: string
    serialNos?: string[]
    status?: HouseMaterialDelivery["status"]
    notes?: string
  }
): Promise<HouseMaterialDelivery> {
  const sb = getSupabaseBrowserClient()
  const previous = await getHouseDeliveryById(id)
  const serialNos = [...new Set((input.serialNos ?? []).map((s) => s.trim()).filter(Boolean))]
  const row = {
    to_household_id: input.toHouseholdId,
    material_name: input.materialName,
    qty: input.qty,
    unit: input.unit ?? null,
    serial_nos: serialNos,
    status: input.status ?? "allocated",
    notes: input.notes ?? null,
  }
  const { data, error } = await q(sb).from("house_material_delivery").update(row).eq("id", id).select().single()
  if (error) throwWarehouseWriteError(error)
  const updated = rowToHouseMaterialDelivery(data as Record<string, unknown>)
  const changedFields: string[] = []
  if (previous) {
    if (previous.toHouseholdId !== updated.toHouseholdId) changedFields.push("toHouseholdId")
    if (previous.materialName !== updated.materialName) changedFields.push("materialName")
    if (previous.qty !== updated.qty) changedFields.push("qty")
    if ((previous.unit ?? "") !== (updated.unit ?? "")) changedFields.push("unit")
    if (previous.status !== updated.status) changedFields.push("status")
    if ((previous.notes ?? "") !== (updated.notes ?? "")) changedFields.push("notes")
    if (JSON.stringify(previous.serialNos ?? []) !== JSON.stringify(updated.serialNos ?? [])) changedFields.push("serialNos")
  }
  try {
    await appendActivityLog({
      entityType: "warehouse_allocation",
      entityId: updated.id,
      action: "updated",
      message: "Allocation updated",
      meta: { changedFields },
    })
  } catch {}
  return updated
}

export async function listHouseMovementEvents(): Promise<HouseMaterialMovementEvent[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from("house_material_movement_events").select("*").order("created_at", { ascending: false })
  if (error) return handleWarehouseReadError(error, [])
  return ((data ?? []) as Array<Record<string, unknown>>).map(rowToHouseMovementEvent)
}

export async function returnHouseMaterial(params: {
  deliveryId: string
  serialNos?: string[]
  notes?: string
  proofPhotoUrl?: string
  proofPhotoGps?: HouseMaterialMovementEvent["proofPhotoGps"]
}): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from("house_material_delivery").select("*").eq("id", params.deliveryId).maybeSingle()
  if (error) throwWarehouseWriteError(error)
  if (!data) throw new Error("Delivery not found.")
  const delivery = rowToHouseMaterialDelivery(data as Record<string, unknown>)
  const selected = params.serialNos && params.serialNos.length > 0 ? params.serialNos : delivery.serialNos
  const selectedNorm = new Set(selected.map(normalizeSerial))
  const remaining = delivery.serialNos.filter((s) => !selectedNorm.has(normalizeSerial(s)))
  const returningQty = selected.length > 0 ? selected.length : delivery.qty

  if (remaining.length === 0) {
    const { error: upErr } = await q(sb)
      .from("house_material_delivery")
      .update({
        status: "returned",
        notes: params.notes ?? delivery.notes ?? null,
        proof_photo_url: params.proofPhotoUrl ?? delivery.proofPhotoUrl ?? null,
        proof_photo_gps: params.proofPhotoGps ?? delivery.proofPhotoGps ?? null,
      })
      .eq("id", delivery.id)
    if (upErr) throwWarehouseWriteError(upErr)
  } else {
    const { error: upErr } = await q(sb)
      .from("house_material_delivery")
      .update({ serial_nos: remaining, qty: remaining.length, notes: delivery.notes ?? null })
      .eq("id", delivery.id)
    if (upErr) throwWarehouseWriteError(upErr)
  }

  const eventId = await nextIdByPrefix("house_material_movement_events", "HME-")
  const { error: eventError } = await q(sb).from("house_material_movement_events").insert({
    id: eventId,
    delivery_id: delivery.id,
    event_type: "return_cancelled",
    from_household_id: delivery.toHouseholdId,
    material_name: delivery.materialName,
    serial_nos: selected,
    qty: returningQty,
    proof_photo_url: params.proofPhotoUrl ?? null,
    proof_photo_gps: params.proofPhotoGps ?? null,
    notes: params.notes ?? null,
  })
  if (eventError) throwWarehouseWriteError(eventError)
}

export async function reassignHouseMaterial(params: {
  sourceDeliveryId: string
  toHouseholdId: string
  serialNos: string[]
  notes?: string
  proofPhotoUrl?: string
  proofPhotoGps?: HouseMaterialMovementEvent["proofPhotoGps"]
}): Promise<HouseMaterialDelivery> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from("house_material_delivery").select("*").eq("id", params.sourceDeliveryId).maybeSingle()
  if (error) throwWarehouseWriteError(error)
  if (!data) throw new Error("Source delivery not found.")
  const source = rowToHouseMaterialDelivery(data as Record<string, unknown>)
  const serials = [...new Set(params.serialNos.map((s) => s.trim()).filter(Boolean))]
  if (serials.length === 0) throw new Error("Select at least one serial to reassign.")

  const sourceNorm = new Set(source.serialNos.map(normalizeSerial))
  for (const s of serials) {
    if (!sourceNorm.has(normalizeSerial(s))) throw new Error(`Serial not in source household: ${s}`)
  }

  await returnHouseMaterial({
    deliveryId: source.id,
    serialNos: serials,
    notes: params.notes,
    proofPhotoUrl: params.proofPhotoUrl,
    proofPhotoGps: params.proofPhotoGps,
  })
  const created = await createHouseDeliveryAllocation({
    fromEntityType: "household",
    fromEntityId: source.toHouseholdId,
    toHouseholdId: params.toHouseholdId,
    materialName: source.materialName,
    qty: serials.length,
    unit: source.unit,
    serialNos: serials,
    notes: params.notes,
    proofPhotoUrl: params.proofPhotoUrl,
    proofPhotoGps: params.proofPhotoGps,
  })
  const eventId = await nextIdByPrefix("house_material_movement_events", "HME-")
  const { error: eventError } = await q(sb).from("house_material_movement_events").insert({
    id: eventId,
    delivery_id: created.id,
    event_type: "reassign",
    from_household_id: source.toHouseholdId,
    to_household_id: params.toHouseholdId,
    material_name: source.materialName,
    serial_nos: serials,
    qty: serials.length,
    proof_photo_url: params.proofPhotoUrl ?? null,
    proof_photo_gps: params.proofPhotoGps ?? null,
    notes: params.notes ?? null,
  })
  if (eventError) throwWarehouseWriteError(eventError)
  return created
}

export async function requestHouseReassignApproval(params: {
  sourceDeliveryId: string
  toHouseholdId: string
  serialNos: string[]
  notes?: string
  actorId?: string
  proofPhotoUrl?: string
  proofPhotoGps?: HouseMaterialMovementEvent["proofPhotoGps"]
}): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from("house_material_delivery").select("*").eq("id", params.sourceDeliveryId).maybeSingle()
  if (error) throwWarehouseWriteError(error)
  if (!data) throw new Error("Source delivery not found.")
  const source = rowToHouseMaterialDelivery(data as Record<string, unknown>)
  const serials = [...new Set(params.serialNos.map((s) => s.trim()).filter(Boolean))]
  if (serials.length === 0) throw new Error("Select at least one serial to reassign.")

  const eventId = await nextIdByPrefix("house_material_movement_events", "HME-")
  const { error: eventError } = await q(sb).from("house_material_movement_events").insert({
    id: eventId,
    delivery_id: source.id,
    event_type: "reassign_request",
    from_household_id: source.toHouseholdId,
    to_household_id: params.toHouseholdId,
    material_name: source.materialName,
    serial_nos: serials,
    qty: serials.length,
    proof_photo_url: params.proofPhotoUrl ?? null,
    proof_photo_gps: params.proofPhotoGps ?? null,
    notes: params.notes ?? null,
    actor_id: params.actorId ?? null,
    approval_status: "pending",
    request_payload: {
      sourceDeliveryId: source.id,
      toHouseholdId: params.toHouseholdId,
      serialNos: serials,
      notes: params.notes ?? null,
    },
  })
  if (eventError) throwWarehouseWriteError(eventError)
}

export async function approveHouseReassignRequest(params: {
  eventId: string
  approverId?: string
  approverRole: string
}): Promise<void> {
  const allowed = new Set(["admin", "manager", "district_store_incharge", "state_store_officer"])
  if (!allowed.has(params.approverRole)) {
    throw new Error("You are not allowed to approve reassignment.")
  }
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from("house_material_movement_events").select("*").eq("id", params.eventId).maybeSingle()
  if (error) throwWarehouseWriteError(error)
  if (!data) throw new Error("Approval request not found.")
  const row = data as Record<string, unknown>
  if (String(row.approval_status ?? "") !== "pending") return
  const payload = (row.request_payload as Record<string, unknown>) ?? {}
  await reassignHouseMaterial({
    sourceDeliveryId: String(payload.sourceDeliveryId ?? ""),
    toHouseholdId: String(payload.toHouseholdId ?? ""),
    serialNos: ((payload.serialNos as string[]) ?? []).map((s) => s.trim()).filter(Boolean),
    notes: String(payload.notes ?? row.notes ?? ""),
    proofPhotoUrl: (row.proof_photo_url as string) ?? undefined,
    proofPhotoGps: (row.proof_photo_gps as HouseMaterialMovementEvent["proofPhotoGps"]) ?? undefined,
  })
  const { error: upErr } = await q(sb)
    .from("house_material_movement_events")
    .update({
      approval_status: "approved",
      approved_by: params.approverId ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq("id", params.eventId)
  if (upErr) throwWarehouseWriteError(upErr)
}

export async function requestHouseAllocationApproval(params: {
  allocationBatchId?: string
  dispatchId?: string
  toHouseholdId: string
  materialName: string
  qty: number
  unit?: string
  serialNos?: string[]
  notes?: string
  actorId?: string
  proofPhotoUrl?: string
  proofPhotoGps?: HouseMaterialMovementEvent["proofPhotoGps"]
}): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const serials = [...new Set((params.serialNos ?? []).map((s) => s.trim()).filter(Boolean))]
  await assertHouseAllocationSerialsAvailable(params.materialName, serials)
  const eventId = await nextIdByPrefix("house_material_movement_events", "HME-")
  const { error } = await q(sb).from("house_material_movement_events").insert({
    id: eventId,
    event_type: "allocate_request",
    to_household_id: params.toHouseholdId,
    material_name: params.materialName,
    serial_nos: serials,
    qty: params.qty,
    proof_photo_url: params.proofPhotoUrl ?? null,
    proof_photo_gps: params.proofPhotoGps ?? null,
    notes: params.notes ?? null,
    actor_id: params.actorId ?? null,
    approval_status: "pending",
    request_payload: {
      allocationBatchId: params.allocationBatchId ?? null,
      dispatchId: params.dispatchId ?? null,
      toHouseholdId: params.toHouseholdId,
      materialName: params.materialName,
      qty: params.qty,
      unit: params.unit ?? null,
      serialNos: serials,
      notes: params.notes ?? null,
      proofPhotoUrl: params.proofPhotoUrl ?? null,
      proofPhotoGps: params.proofPhotoGps ?? null,
    },
  })
  if (error) throwWarehouseWriteError(error)
}

export async function approveHouseAllocationRequest(params: {
  eventId: string
  approverId?: string
  approverRole: string
}): Promise<void> {
  const allowed = new Set(["admin", "manager", "district_store_incharge", "state_store_officer"])
  if (!allowed.has(params.approverRole)) {
    throw new Error("You are not allowed to approve allocation.")
  }
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from("house_material_movement_events").select("*").eq("id", params.eventId).maybeSingle()
  if (error) throwWarehouseWriteError(error)
  if (!data) throw new Error("Approval request not found.")
  const row = data as Record<string, unknown>
  if (String(row.approval_status ?? "") !== "pending") return
  const payload = (row.request_payload as Record<string, unknown>) ?? {}
  await createHouseDeliveryAllocation({
    allocationBatchId: (payload.allocationBatchId as string) ?? undefined,
    dispatchId: (payload.dispatchId as string) ?? undefined,
    toHouseholdId: String(payload.toHouseholdId ?? ""),
    materialName: String(payload.materialName ?? ""),
    qty: Number(payload.qty ?? 0),
    unit: (payload.unit as string) ?? undefined,
    serialNos: ((payload.serialNos as string[]) ?? []).map((s) => s.trim()).filter(Boolean),
    notes: String(payload.notes ?? ""),
    proofPhotoUrl: (payload.proofPhotoUrl as string) ?? undefined,
    proofPhotoGps: (payload.proofPhotoGps as HouseMaterialMovementEvent["proofPhotoGps"]) ?? undefined,
  })
  const { error: upErr } = await q(sb)
    .from("house_material_movement_events")
    .update({
      approval_status: "approved",
      approved_by: params.approverId ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq("id", params.eventId)
  if (upErr) throwWarehouseWriteError(upErr)
}

export async function listEligibleHouseholdSerials(params: {
  householdId: string
  materialName: string
}): Promise<string[]> {
  const sb = getSupabaseBrowserClient()
  const { householdId, materialName } = params
  const { data, error } = await q(sb)
    .from("house_material_delivery")
    .select("serial_nos, status")
    .eq("to_household_id", householdId)
    .ilike("material_name", materialName)
  if (error) return handleWarehouseReadError(error, [])

  const eligibleStatuses = new Set(["allocated", "delivered", "reassigned"])
  const out = new Set<string>()
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const status = String(row.status ?? "").toLowerCase()
    if (!eligibleStatuses.has(status)) continue
    for (const serial of ((row.serial_nos as string[]) ?? [])) {
      const s = serial.trim()
      if (s) out.add(s)
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b))
}

export async function markHouseholdSerialsInstalled(params: {
  householdId: string
  materialName: string
  serialNos: string[]
  installationId: string
}): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const serials = [...new Set(params.serialNos.map((s) => s.trim()).filter(Boolean))]
  if (serials.length === 0) return

  const { data, error } = await q(sb)
    .from("house_material_delivery")
    .select("id, serial_nos, status")
    .eq("to_household_id", params.householdId)
    .ilike("material_name", params.materialName)
  if (error) throwWarehouseWriteError(error)

  const eligibleStatuses = new Set(["allocated", "delivered", "reassigned"])
  const targetNorm = new Set(serials.map(normalizeSerial))
  const updateIds: string[] = []

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const status = String(row.status ?? "").toLowerCase()
    if (!eligibleStatuses.has(status)) continue
    const rowSerials = ((row.serial_nos as string[]) ?? []).map((s) => s.trim()).filter(Boolean)
    const hasAny = rowSerials.some((s) => targetNorm.has(normalizeSerial(s)))
    if (!hasAny) continue
    updateIds.push(String(row.id))
  }

  if (updateIds.length === 0) return

  // Single bulk update avoids N sequential network round-trips on slow mobile links.
  const { error: updateError } = await q(sb)
    .from("house_material_delivery")
    .update({ status: "installed", installed_ref_id: params.installationId })
    .in("id", updateIds)
  if (updateError) throwWarehouseWriteError(updateError)
}

// ── Material Master Summary ────────────────────────────────────

export type MaterialMasterRow = {
  material: string
  requiredTotal: number
  /** Cumulative GRN / material_inward receipt quantities (all warehouses) */
  inwardQty: number
  /** Cumulative delivery challan line quantities (material_dispatch, all legs) */
  dcChallanQty: number
  /** inwardQty + dcChallanQty — project pipeline total (flows, not physical stock) */
  inwardPlusDispatchQty: number
  issued: number
  returned: number
  /** On-hand at Kurnool central warehouse (WH-002): GRN in − DC out + DC in + field returns in − supplier RMA out */
  knLiveQty: number
  /** Cumulative supplier RMA line quantities (all warehouses), for transparency */
  supplierRmaQty: number
}

export type MaterialDefinition = {
  id: string
  name: string
  perHh: number
  unit?: string
  createdAt?: string
  /** Wedge / camera scan required for each serial on inward */
  requiresBarcode?: boolean
  /** When false, quantity-only (no per-serial checks) */
  trackSerial?: boolean
}

const DEFAULT_MATERIAL_DEFINITIONS: MaterialDefinition[] = [
  { id: "MAT-001", name: "Solar PV Module", perHh: 4, unit: "Nos", requiresBarcode: true, trackSerial: true },
  { id: "MAT-002", name: "Inverter", perHh: 1, unit: "Nos", requiresBarcode: true, trackSerial: true },
  { id: "MAT-003", name: "Structure", perHh: 1, unit: "Nos" },
  { id: "MAT-004", name: "Bolts Set", perHh: 1, unit: "Nos" },
  { id: "MAT-005", name: "4.0 Sqmm DC Cable BLACK", perHh: 10, unit: "Mtr" },
  { id: "MAT-006", name: "4.0 SQMM DC CABLE RED & BLACK", perHh: 10, unit: "Mtr" },
  { id: "MAT-007", name: "16SQMM GREEN WIRE", perHh: 25, unit: "Mtr" },
  { id: "MAT-008", name: "ACDB BOX& DCDB BOX", perHh: 1, unit: "Nos" },
  { id: "MAT-009", name: "MC4 CONNECTERS PACK", perHh: 1, unit: "Nos" },
  { id: "MAT-010", name: "45*45 PVC CHANNEL", perHh: 1, unit: "Nos" },
  { id: "MAT-011", name: "PVC PIPE", perHh: 8, unit: "Nos" },
  { id: "MAT-012", name: "1' FLEXIBLE PIPE", perHh: 1, unit: "Nos" },
  { id: "MAT-013", name: "AC CABLE RED", perHh: 3, unit: "Mtr" },
  { id: "MAT-014", name: "AC CABLE RED &BLACK", perHh: 3, unit: "Mtr" },
  { id: "MAT-015", name: "EARTHING KIT", perHh: 1, unit: "Nos" },
  { id: "MAT-016", name: "CONDUIT KIT", perHh: 1, unit: "Nos" },
]

type IssueRow = {
  items?: VillageIssueItem[]
  households_approved?: number
}

function buildMaterialMasterSummary(params: {
  totalHouseholds: number
  inwardItems: WarehouseItem[]
  dispatchItems: WarehouseItem[]
  issueItems: VillageIssueItem[]
  returnItems: WarehouseItem[]
  materials: MaterialDefinition[]
}): Omit<MaterialMasterRow, 'knLiveQty' | 'supplierRmaQty'>[] {
  const { totalHouseholds, inwardItems, dispatchItems, issueItems, returnItems, materials } = params
  const inwardByName = new Map<string, number>()
  const dispatchedByName = new Map<string, number>()
  const issuedByName = new Map<string, number>()
  const returnedByName = new Map<string, number>()

  for (const item of inwardItems) {
    inwardByName.set(item.name, (inwardByName.get(item.name) ?? 0) + (item.qty ?? 0))
  }
  for (const item of dispatchItems) {
    dispatchedByName.set(item.name, (dispatchedByName.get(item.name) ?? 0) + (item.qty ?? 0))
  }
  for (const item of issueItems) {
    issuedByName.set(item.name, (issuedByName.get(item.name) ?? 0) + (item.totalQty ?? 0))
  }
  for (const item of returnItems) {
    returnedByName.set(item.name, (returnedByName.get(item.name) ?? 0) + (item.qty ?? 0))
  }

  return materials.map(({ name, perHh }) => {
    const inward = inwardByName.get(name) ?? 0
    const dcOnly = dispatchedByName.get(name) ?? 0
    const issued = issuedByName.get(name) ?? 0
    const returned = returnedByName.get(name) ?? 0
    const inwardPlusDispatchQty = inward + dcOnly
    return {
      material: name,
      requiredTotal: totalHouseholds * perHh,
      inwardQty: inward,
      dcChallanQty: dcOnly,
      inwardPlusDispatchQty,
      issued,
      returned,
    }
  })
}

export async function listMaterialDefinitions(): Promise<MaterialDefinition[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb)
    .from('material_master')
    .select('id, name, per_hh, unit, created_at, requires_barcode, track_serial')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) return handleWarehouseReadError(error, DEFAULT_MATERIAL_DEFINITIONS)
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    perHh: Number(r.per_hh ?? 0),
    unit: (r.unit as string) ?? undefined,
    createdAt: (r.created_at as string) ?? undefined,
    requiresBarcode: Boolean(r.requires_barcode ?? false),
    trackSerial: r.track_serial !== false,
  }))
}

export async function createMaterialDefinition(input: {
  name: string
  perHh: number
  unit?: string
  requiresBarcode?: boolean
  trackSerial?: boolean
}): Promise<MaterialDefinition> {
  const sb = getSupabaseBrowserClient()
  const trimmedName = input.name.trim()
  if (!trimmedName) throw new Error("Material name is required.")
  if (!Number.isFinite(input.perHh) || input.perHh <= 0) throw new Error("Per-household quantity must be greater than 0.")

  const { data: existingName, error: existingNameError } = await q(sb)
    .from('material_master')
    .select('id')
    .ilike('name', trimmedName)
    .limit(1)
  if (existingNameError) throwWarehouseWriteError(existingNameError)
  if ((existingName ?? []).length > 0) throw new Error("Material already exists.")

  const { data: existingIds, error: existingIdsError } = await q(sb)
    .from('material_master')
    .select('id')
    .like('id', 'MAT-%')
  if (existingIdsError) throwWarehouseWriteError(existingIdsError)

  let max = 0
  for (const r of existingIds ?? []) {
    const m = /^MAT-(\d+)$/.exec(r.id as string)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const id = `MAT-${(max + 1).toString().padStart(3, '0')}`
  const row = {
    id,
    name: trimmedName,
    per_hh: input.perHh,
    unit: input.unit?.trim() || null,
    is_active: true,
    requires_barcode: input.requiresBarcode ?? false,
    track_serial: input.trackSerial !== false,
  }
  const { data, error } = await q(sb).from('material_master').insert(row).select().single()
  if (error) throwWarehouseWriteError(error)

  const result = data as Record<string, unknown>
  return {
    id: result.id as string,
    name: result.name as string,
    perHh: Number(result.per_hh ?? 0),
    unit: (result.unit as string) ?? undefined,
    createdAt: (result.created_at as string) ?? undefined,
    requiresBarcode: Boolean(result.requires_barcode ?? false),
    trackSerial: result.track_serial !== false,
  }
}

/** Village issue totals only — one small query instead of loading all `items` JSON from multiple tables. */
export async function getProjectUtilizationQuick(totalHouseholds = 8929): Promise<{
  totalApproved: number
  householdsIssued: number
  householdsPending: number
}> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await q(sb).from('material_issue_village').select('households_approved')
  if (error) {
    handleWarehouseReadError(error, [])
    return {
      totalApproved: totalHouseholds,
      householdsIssued: 0,
      householdsPending: Math.max(0, totalHouseholds),
    }
  }
  type Row = { households_approved?: number | null }
  const householdsIssued = ((data ?? []) as Row[]).reduce((s, r) => s + (Number(r.households_approved) || 0), 0)
  return {
    totalApproved: totalHouseholds,
    householdsIssued,
    householdsPending: Math.max(0, totalHouseholds - householdsIssued),
  }
}

export async function getMaterialMasterDashboard(totalHouseholds = 8929): Promise<{
  utilization: {
    totalApproved: number
    householdsIssued: number
    householdsPending: number
  }
  materials: MaterialMasterRow[]
}> {
  const sb = getSupabaseBrowserClient()
  const [inwardRes, dispatchRes, issueRes, returnRes, masterRes, stockRows, supRes] = await Promise.all([
    q(sb).from('material_inward').select('items'),
    q(sb).from('material_dispatch').select('items'),
    q(sb).from('material_issue_village').select('items, households_approved'),
    q(sb).from('material_returns').select('items'),
    q(sb)
      .from('material_master')
      .select('id, name, per_hh, unit, created_at, requires_barcode, track_serial')
      .eq('is_active', true)
      .order('created_at'),
    getWarehouseStockBalances(DEFAULT_WAREHOUSE_ID),
    q(sb).from('supplier_material_returns').select('items'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inwardItems = inwardRes.error
    ? handleWarehouseReadError(inwardRes.error, [] as WarehouseItem[])
    : ((inwardRes.data ?? []) as Array<{ items?: WarehouseItem[] }>).flatMap((r) => r.items ?? [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatchItems = dispatchRes.error
    ? handleWarehouseReadError(dispatchRes.error, [] as WarehouseItem[])
    : ((dispatchRes.data ?? []) as Array<{ items?: WarehouseItem[] }>).flatMap((r) => r.items ?? [])

  const issueRows = issueRes.error
    ? handleWarehouseReadError(issueRes.error, [] as IssueRow[])
    : ((issueRes.data ?? []) as IssueRow[])
  const issueItems = issueRows.flatMap((r) => r.items ?? [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const returnItems = returnRes.error
    ? handleWarehouseReadError(returnRes.error, [] as WarehouseItem[])
    : ((returnRes.data ?? []) as Array<{ items?: WarehouseItem[] }>).flatMap((r) => r.items ?? [])

  const materials = masterRes.error
    ? handleWarehouseReadError(masterRes.error, DEFAULT_MATERIAL_DEFINITIONS)
    : ((masterRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        perHh: Number(r.per_hh ?? 0),
        unit: (r.unit as string) ?? undefined,
        createdAt: (r.created_at as string) ?? undefined,
        requiresBarcode: Boolean(r.requires_barcode ?? false),
        trackSerial: r.track_serial !== false,
      }))
  const householdsIssued = issueRows.reduce((sum, row) => sum + (row.households_approved ?? 0), 0)

  const supplierRmaByName = new Map<string, number>()
  if (!supRes.error) {
    const supRows = (supRes.data ?? []) as Array<{ items?: WarehouseItem[] }>
    for (const row of supRows) {
      for (const item of row.items ?? []) {
        supplierRmaByName.set(item.name, (supplierRmaByName.get(item.name) ?? 0) + (item.qty ?? 0))
      }
    }
  } else {
    handleWarehouseReadError(supRes.error, [])
  }

  const stockByName = new Map<string, number>()
  for (const r of stockRows) {
    stockByName.set(r.material, r.qty)
  }

  const summary = buildMaterialMasterSummary({
    totalHouseholds,
    inwardItems,
    dispatchItems,
    issueItems,
    returnItems,
    materials,
  })

  const materialsOut = summary.map((row) => ({
    ...row,
    knLiveQty: stockByName.get(row.material) ?? 0,
    supplierRmaQty: supplierRmaByName.get(row.material) ?? 0,
  }))

  return {
    utilization: {
      totalApproved: totalHouseholds,
      householdsIssued,
      householdsPending: Math.max(0, totalHouseholds - householdsIssued),
    },
    materials: materialsOut,
  }
}

export async function getMaterialMasterSummary(totalHouseholds = 8929): Promise<MaterialMasterRow[]> {
  const { materials } = await getMaterialMasterDashboard(totalHouseholds)
  return materials
}

export async function getProjectUtilization(totalHouseholds = 8929): Promise<{
  totalApproved: number
  householdsIssued: number
  householdsPending: number
}> {
  return getProjectUtilizationQuick(totalHouseholds)
}

// ── Stock ledger & per-warehouse balances ──────────────────────

export type LedgerMovementRow = {
  occurredAt: string
  docType: "grn_inward" | "dc_dispatch" | "field_return" | "supplier_rma" | "village_issue"
  docId: string
  material: string
  qty: number
  direction: "in" | "out"
  label: string
  detail?: string
}

export async function getStockLedgerMovements(): Promise<LedgerMovementRow[]> {
  const sb = getSupabaseBrowserClient()
  const [inwardRes, dispatchRes, returnRes, issueRes, supRes] = await Promise.all([
    q(sb).from("material_inward").select("id, inward_date, po_number, warehouse_id, items, created_at, notes"),
    q(sb)
      .from("material_dispatch")
      .select("id, dispatch_date, from_warehouse_id, to_warehouse_id, items, created_at, notes, dc_number"),
    q(sb).from("material_returns").select("id, return_date, to_warehouse_id, items, created_at, return_reason"),
    q(sb)
      .from("material_issue_village")
      .select("id, issue_date, issue_challan_no, from_warehouse_id, village_name, mandal, items, created_at"),
    q(sb).from("supplier_material_returns").select("id, return_date, from_warehouse_id, po_number, items, created_at, status"),
  ])

  const rows: LedgerMovementRow[] = []

  const inwardData = inwardRes.error
    ? handleWarehouseReadError(inwardRes.error, [] as Record<string, unknown>[])
    : ((inwardRes.data ?? []) as Record<string, unknown>[])
  for (const r of inwardData) {
    const ts = String(r.created_at ?? r.inward_date ?? "")
    const items = (r.items as WarehouseItem[]) ?? []
    for (const it of items) {
      rows.push({
        occurredAt: ts,
        docType: "grn_inward",
        docId: r.id as string,
        material: it.name,
        qty: it.qty,
        direction: "in",
        label: `GRN ${String(r.id)} · PO ${String(r.po_number ?? "—")}`,
        detail: (r.notes as string) ?? undefined,
      })
    }
  }

  const dispatchData = dispatchRes.error
    ? handleWarehouseReadError(dispatchRes.error, [] as Record<string, unknown>[])
    : ((dispatchRes.data ?? []) as Record<string, unknown>[])
  for (const r of dispatchData) {
    const ts = String(r.created_at ?? r.dispatch_date ?? "")
    const items = (r.items as WarehouseItem[]) ?? []
    const dc = String(r.dc_number ?? r.id ?? "")
    for (const it of items) {
      rows.push({
        occurredAt: ts,
        docType: "dc_dispatch",
        docId: r.id as string,
        material: it.name,
        qty: it.qty,
        direction: "out",
        label: `DC ${dc} dispatch`,
        detail: [r.from_warehouse_id ? `from ${r.from_warehouse_id}` : null, r.to_warehouse_id ? `to ${r.to_warehouse_id}` : null]
          .filter(Boolean)
          .join(" · ") || undefined,
      })
    }
  }

  const returnData = returnRes.error
    ? handleWarehouseReadError(returnRes.error, [] as Record<string, unknown>[])
    : ((returnRes.data ?? []) as Record<string, unknown>[])
  for (const r of returnData) {
    const ts = String(r.created_at ?? r.return_date ?? "")
    const items = (r.items as WarehouseItem[]) ?? []
    for (const it of items) {
      rows.push({
        occurredAt: ts,
        docType: "field_return",
        docId: r.id as string,
        material: it.name,
        qty: it.qty,
        direction: "in",
        label: `Field return ${String(r.id)} → WH ${String(r.to_warehouse_id ?? "—")}`,
        detail: String(r.return_reason ?? ""),
      })
    }
  }

  const issueData = issueRes.error
    ? handleWarehouseReadError(issueRes.error, [] as Record<string, unknown>[])
    : ((issueRes.data ?? []) as Record<string, unknown>[])
  for (const r of issueData) {
    const ts = String(r.created_at ?? r.issue_date ?? "")
    const items = (r.items as VillageIssueItem[]) ?? []
    for (const it of items) {
      rows.push({
        occurredAt: ts,
        docType: "village_issue",
        docId: r.id as string,
        material: it.name,
        qty: it.totalQty,
        direction: "out",
        label: `Village issue ${String(r.issue_challan_no ?? r.id)} · ${String(r.village_name ?? "")}`,
        detail: [r.from_warehouse_id ? `from ${r.from_warehouse_id}` : null].filter(Boolean).join(" · ") || undefined,
      })
    }
  }

  const supData = supRes.error
    ? handleWarehouseReadError(supRes.error, [] as Record<string, unknown>[])
    : ((supRes.data ?? []) as Record<string, unknown>[])
  for (const r of supData) {
    const ts = String(r.created_at ?? r.return_date ?? "")
    const items = (r.items as WarehouseItem[]) ?? []
    for (const it of items) {
      rows.push({
        occurredAt: ts,
        docType: "supplier_rma",
        docId: r.id as string,
        material: it.name,
        qty: it.qty,
        direction: "out",
        label: `Supplier RMA ${String(r.id)} · PO ${String(r.po_number ?? "—")}`,
        detail: String(r.status ?? ""),
      })
    }
  }

  return rows.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}

export async function getWarehouseStockBalances(warehouseId: string): Promise<Array<{ material: string; qty: number }>> {
  const [inwards, dispatches, returns, supplierRmas, defs] = await Promise.all([
    listInwards(),
    listDispatches(),
    listReturns(),
    listSupplierReturns(),
    listMaterialDefinitions(),
  ])

  const bal = new Map<string, number>()
  const apply = (material: string, delta: number) => {
    const k = normalizeMaterial(material)
    bal.set(k, (bal.get(k) ?? 0) + delta)
  }

  for (const inv of inwards) {
    if (inv.warehouseId !== warehouseId) continue
    for (const it of inv.items ?? []) apply(it.name, effectiveWarehouseItemQty(it))
  }
  for (const d of dispatches) {
    const fromWh = d.fromWarehouseId ?? DEFAULT_WAREHOUSE_ID
    for (const it of d.items ?? []) {
      const q = effectiveWarehouseItemQty(it)
      if (fromWh === warehouseId) apply(it.name, -q)
      if (d.toWarehouseId === warehouseId) apply(it.name, q)
    }
  }
  for (const r of returns) {
    if (r.toWarehouseId !== warehouseId) continue
    for (const it of r.items ?? []) apply(it.name, effectiveWarehouseItemQty(it))
  }
  for (const s of supplierRmas) {
    if (s.fromWarehouseId !== warehouseId) continue
    for (const it of s.items ?? []) apply(it.name, -effectiveWarehouseItemQty(it))
  }

  return defs
    .map((d) => ({ material: d.name, qty: bal.get(normalizeMaterial(d.name)) ?? 0 }))
    .sort((a, b) => a.material.localeCompare(b.material))
}
