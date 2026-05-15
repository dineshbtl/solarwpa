import type { MaterialDispatch, MaterialInward, MaterialReturn, WarehouseItem } from "@/lib/store/warehouse"
import {
  assertDispatchSerialsForWarehouse,
  assertDispatchSerialsGlobally,
  collectExistingSerialsFromInwards,
  definitionsByMaterialKey,
  validateInwardPayload,
} from "@/lib/inventory/stock-validation"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}

export async function validateInwardInsertServer(supabase: unknown, items: WarehouseItem[]): Promise<void> {
  const sb = supabase
  const { data: inwardRowsRaw, error: inwardSelErr } = await q(sb).from("material_inward").select("id, items")
  if (inwardSelErr) throw inwardSelErr
  const { data: masterRows, error: masterErr } = await q(sb)
    .from("material_master")
    .select("name, requires_barcode, track_serial")
    .eq("is_active", true)
  if (masterErr) throw masterErr
  const defs = ((masterRows ?? []) as Array<Record<string, unknown>>).map((r) => ({
    name: String(r.name),
    requiresBarcode: Boolean(r.requires_barcode),
    trackSerial: r.track_serial !== false,
  }))
  const rules = definitionsByMaterialKey(defs)
  const existingSerials = collectExistingSerialsFromInwards(
    ((inwardRowsRaw ?? []) as Array<{ id: string; items?: WarehouseItem[] }>).map((r) => ({
      id: r.id,
      items: r.items ?? [],
    }))
  )
  validateInwardPayload(items, rules, existingSerials)
}

export async function validateDispatchInsertServer(
  supabase: unknown,
  input: Pick<MaterialDispatch, "items" | "fromWarehouseId">
): Promise<void> {
  const sb = supabase
  const requestedItems = input.items.filter((item) => (item.serialNos ?? []).length > 0)
  if (requestedItems.length === 0) return

  const [inwardRes, dispatchRes, returnRes, supRes] = await Promise.all([
    q(sb).from("material_inward").select("id, warehouse_id, items"),
    q(sb).from("material_dispatch").select("id, from_warehouse_id, to_warehouse_id, items"),
    q(sb).from("material_returns").select("id, to_warehouse_id, items"),
    q(sb).from("supplier_material_returns").select("from_warehouse_id, items"),
  ])
  if (inwardRes.error) throw inwardRes.error
  if (dispatchRes.error) throw dispatchRes.error
  if (returnRes.error) throw returnRes.error

  const inwards = ((inwardRes.data ?? []) as Record<string, unknown>[]).map(
    (r) =>
      ({
        id: r.id,
        warehouseId: (r.warehouse_id as string) ?? undefined,
        items: (r.items as WarehouseItem[]) ?? [],
        inwardDate: "",
        poNumber: "",
        createdAt: "",
      }) as MaterialInward
  )

  const dispatches = ((dispatchRes.data ?? []) as Record<string, unknown>[]).map(
    (r) =>
      ({
        id: r.id,
        fromWarehouseId: (r.from_warehouse_id as string) ?? undefined,
        toWarehouseId: (r.to_warehouse_id as string) ?? undefined,
        items: (r.items as WarehouseItem[]) ?? [],
        dcNumber: "",
        dispatchDate: "",
        status: "dispatched",
        createdAt: "",
      }) as MaterialDispatch
  )

  const returns = ((returnRes.data ?? []) as Record<string, unknown>[]).map(
    (r) =>
      ({
        id: r.id,
        toWarehouseId: (r.to_warehouse_id as string) ?? undefined,
        items: (r.items as WarehouseItem[]) ?? [],
        returnDate: "",
        returnReason: "excess",
        createdAt: "",
      }) as MaterialReturn
  )

  const supplierRmas = supRes.error
    ? []
    : (((supRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
        fromWarehouseId: (r.from_warehouse_id as string) ?? undefined,
        items: (r.items as WarehouseItem[]) ?? [],
      })) as Array<{ fromWarehouseId?: string; items: WarehouseItem[] }>)

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
      supplierRmas
    )
  } else {
    assertDispatchSerialsGlobally(input.items, inwardPick, dispatchPick, returnPick, supplierPick)
  }
}
