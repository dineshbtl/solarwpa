import {
  DEFAULT_WAREHOUSE_ID,
  type MaterialDispatch,
  type MaterialInward,
  type MaterialReturn,
  type WarehouseItem,
} from "@/lib/store/warehouse"

/** Shape from material master (name + scan rules) */
export type MaterialRuleInput = { name: string; requiresBarcode?: boolean; trackSerial?: boolean }

export type MaterialTrackingRule = {
  requiresBarcode: boolean
  trackSerial: boolean
}

export function normalizeMaterial(name: string): string {
  return name.trim().toLowerCase()
}

export function normalizeSerial(serial: string): string {
  return serial.trim().toLowerCase()
}

export function normalizeBarcode(barcode: string): string {
  return barcode.trim().toLowerCase()
}

/**
 * Quantity for stock balance: serialized lines use serial count when any serials are present,
 * otherwise line `qty` (bulk / non-serialized rows).
 */
export function effectiveWarehouseItemQty(item: Pick<WarehouseItem, "qty" | "serialNos">): number {
  const serialCount = (item.serialNos ?? []).map((s) => s.trim()).filter(Boolean).length
  if (serialCount > 0) return serialCount
  return item.qty ?? 0
}

/** Merge definitions keyed by normalized material name */
export function definitionsByMaterialKey(defs: MaterialRuleInput[]): Map<string, MaterialTrackingRule> {
  const map = new Map<string, MaterialTrackingRule>()
  for (const d of defs) {
    map.set(normalizeMaterial(d.name), {
      requiresBarcode: !!d.requiresBarcode,
      trackSerial: d.trackSerial !== false,
    })
  }
  return map
}

export function collectSerialsFromPayload(items: WarehouseItem[]): Map<string, Set<string>> {
  const byMat = new Map<string, Set<string>>()
  for (const item of items) {
    const mk = normalizeMaterial(item.name)
    const set = byMat.get(mk) ?? new Set<string>()
    for (const s of item.serialNos ?? []) {
      const ns = normalizeSerial(s)
      if (ns) set.add(ns)
    }
    byMat.set(mk, set)
  }
  return byMat
}

export function assertPayloadSerialsUnique(items: WarehouseItem[]): void {
  const seen = new Map<string, Set<string>>()
  for (const item of items) {
    const mk = normalizeMaterial(item.name)
    const bucket = seen.get(mk) ?? new Set<string>()
    for (const raw of item.serialNos ?? []) {
      const sn = normalizeSerial(raw)
      if (!sn) continue
      if (bucket.has(sn)) {
        throw new Error(`Duplicate serial in submission for ${item.name}: ${raw.trim()}`)
      }
      bucket.add(sn)
    }
    seen.set(mk, bucket)
  }
}

export function validateBarcodeCoverage(
  items: WarehouseItem[],
  rules: Map<string, MaterialTrackingRule>
): void {
  for (const item of items) {
    const rule = rules.get(normalizeMaterial(item.name))
    const serials = (item.serialNos ?? []).map((s) => s.trim()).filter(Boolean)
    if (!rule?.requiresBarcode || serials.length === 0) continue

    const barcodes = (item.barcodes ?? []).map((b) => b.trim()).filter(Boolean)
    // Wedge / label barcodes are optional: only validate counts when the user supplied at least one.
    if (barcodes.length === 0) continue
    if (barcodes.length !== serials.length) {
      throw new Error(
        `${item.name}: barcode count (${barcodes.length}) must match serial count (${serials.length}) when barcodes are entered.`
      )
    }
    const bcSeen = new Set<string>()
    for (const bc of barcodes) {
      const k = normalizeBarcode(bc)
      if (!k) throw new Error(`${item.name}: empty barcode line is not allowed when barcodes are provided.`)
      if (bcSeen.has(k)) throw new Error(`${item.name}: duplicate barcode in line: ${bc}`)
      bcSeen.add(k)
    }
  }
}

/** Legacy global pool: inward − (dispatched ∧ ¬returned field). Used when dispatch has no fromWarehouseId. */
export function buildGlobalOutstandingSerialMaps(
  inwardRows: Pick<MaterialInward, "items">[],
  dispatchRows: Pick<MaterialDispatch, "items">[],
  returnRows: Pick<MaterialReturn, "items">[]
): {
  inwardByMaterial: Map<string, Set<string>>
  dispatchedOutstandingByMaterial: Map<string, Set<string>>
} {
  const inwardByMaterial = new Map<string, Set<string>>()
  const dispatchedByMaterial = new Map<string, Set<string>>()
  const returnedByMaterial = new Map<string, Set<string>>()

  for (const row of inwardRows) {
    for (const item of row.items ?? []) {
      const mat = normalizeMaterial(item.name)
      const set = inwardByMaterial.get(mat) ?? new Set<string>()
      for (const serial of item.serialNos ?? []) {
        const s = normalizeSerial(serial)
        if (s) set.add(s)
      }
      inwardByMaterial.set(mat, set)
    }
  }
  for (const row of dispatchRows) {
    for (const item of row.items ?? []) {
      const mat = normalizeMaterial(item.name)
      const set = dispatchedByMaterial.get(mat) ?? new Set<string>()
      for (const serial of item.serialNos ?? []) {
        const s = normalizeSerial(serial)
        if (s) set.add(s)
      }
      dispatchedByMaterial.set(mat, set)
    }
  }
  for (const row of returnRows) {
    for (const item of row.items ?? []) {
      const mat = normalizeMaterial(item.name)
      const set = returnedByMaterial.get(mat) ?? new Set<string>()
      for (const serial of item.serialNos ?? []) {
        const s = normalizeSerial(serial)
        if (s) set.add(s)
      }
      returnedByMaterial.set(mat, set)
    }
  }

  const dispatchedOutstandingByMaterial = new Map<string, Set<string>>()
  for (const [mat, dispSet] of dispatchedByMaterial) {
    const retSet = returnedByMaterial.get(mat) ?? new Set<string>()
    const out = new Set<string>()
    for (const s of dispSet) {
      if (!retSet.has(s)) out.add(s)
    }
    dispatchedOutstandingByMaterial.set(mat, out)
  }

  return { inwardByMaterial, dispatchedOutstandingByMaterial }
}

function subtractSerialSets(
  base: Map<string, Set<string>>,
  removals: Array<{ items: WarehouseItem[] }>
): Map<string, Set<string>> {
  const copy = new Map<string, Set<string>>()
  for (const [k, v] of base) copy.set(k, new Set(v))
  for (const row of removals) {
    for (const item of row.items ?? []) {
      const mat = normalizeMaterial(item.name)
      const set = copy.get(mat)
      if (!set) continue
      for (const raw of item.serialNos ?? []) {
        const sn = normalizeSerial(raw)
        if (sn) set.delete(sn)
      }
    }
  }
  return copy
}

export function assertDispatchSerialsGlobally(
  requestedItems: WarehouseItem[],
  inwardRows: Pick<MaterialInward, "items">[],
  dispatchRows: Pick<MaterialDispatch, "items">[],
  returnRows: Pick<MaterialReturn, "items">[],
  supplierRmaRows: Array<{ items: WarehouseItem[] }> = []
): void {
  const { inwardByMaterial, dispatchedOutstandingByMaterial } = buildGlobalOutstandingSerialMaps(
    inwardRows,
    dispatchRows,
    returnRows
  )
  const inwardEffective =
    supplierRmaRows.length > 0 ? subtractSerialSets(inwardByMaterial, supplierRmaRows) : inwardByMaterial

  const requestedWithSerials = requestedItems.filter((item) => (item.serialNos ?? []).length > 0)
  for (const item of requestedWithSerials) {
    const serials = (item.serialNos ?? []).map((s) => s.trim()).filter(Boolean)
    if (serials.length !== item.qty) {
      throw new Error(`Serial count for ${item.name} must match quantity.`)
    }
    const mat = normalizeMaterial(item.name)
    const inwardSet = inwardEffective.get(mat) ?? new Set<string>()
    const outstanding = dispatchedOutstandingByMaterial.get(mat) ?? new Set<string>()
    const seen = new Set<string>()
    for (const rawSerial of serials) {
      const serial = normalizeSerial(rawSerial)
      if (!serial) continue
      if (seen.has(serial)) {
        throw new Error(`Duplicate serial in dispatch payload for ${item.name}: ${rawSerial}`)
      }
      seen.add(serial)
      if (!inwardSet.has(serial)) {
        throw new Error(`Serial not found in inward stock for ${item.name}: ${rawSerial}`)
      }
      if (outstanding.has(serial)) {
        throw new Error(`Serial already dispatched (still outstanding) for ${item.name}: ${rawSerial}`)
      }
    }
  }
}

/**
 * Per-warehouse availability for serialized SKUs at `warehouseId`:
 * inward(at WH) − dispatch(from WH) + dispatch(to WH) + field returns(to WH) − supplier RMA(from WH).
 * Dispatch lines with no `fromWarehouseId` are treated as outbound from {@link DEFAULT_WAREHOUSE_ID} (Kurnool DC seed).
 */
export function buildAvailableSerialsAtWarehouse(
  warehouseId: string,
  inwardRows: MaterialInward[],
  dispatchRows: MaterialDispatch[],
  fieldReturnRows: MaterialReturn[],
  supplierRmaRows: Array<{ fromWarehouseId?: string; items: WarehouseItem[] }>
): Map<string, Set<string>> {
  const available = new Map<string, Set<string>>()

  const addSerial = (materialName: string, serial: string) => {
    const mat = normalizeMaterial(materialName)
    const s = normalizeSerial(serial)
    if (!s) return
    const set = available.get(mat) ?? new Set<string>()
    set.add(s)
    available.set(mat, set)
  }
  const removeSerial = (materialName: string, serial: string) => {
    const mat = normalizeMaterial(materialName)
    const s = normalizeSerial(serial)
    const set = available.get(mat)
    if (set) set.delete(s)
  }

  for (const inward of inwardRows) {
    if (inward.warehouseId !== warehouseId) continue
    for (const item of inward.items ?? []) {
      for (const ser of item.serialNos ?? []) addSerial(item.name, ser)
    }
  }

  for (const d of dispatchRows) {
    const fromWh = d.fromWarehouseId ?? DEFAULT_WAREHOUSE_ID
    for (const item of d.items ?? []) {
      for (const ser of item.serialNos ?? []) {
        if (fromWh === warehouseId) removeSerial(item.name, ser)
        if (d.toWarehouseId === warehouseId) addSerial(item.name, ser)
      }
    }
  }

  for (const r of fieldReturnRows) {
    if (r.toWarehouseId !== warehouseId) continue
    for (const item of r.items ?? []) {
      for (const ser of item.serialNos ?? []) addSerial(item.name, ser)
    }
  }

  for (const r of supplierRmaRows) {
    if (r.fromWarehouseId !== warehouseId) continue
    for (const item of r.items ?? []) {
      for (const ser of item.serialNos ?? []) removeSerial(item.name, ser)
    }
  }

  return available
}

export function assertDispatchSerialsForWarehouse(
  fromWarehouseId: string,
  requestedItems: WarehouseItem[],
  inwardRows: MaterialInward[],
  dispatchRows: MaterialDispatch[],
  fieldReturnRows: MaterialReturn[],
  supplierRmaRows: Array<{ fromWarehouseId?: string; items: WarehouseItem[] }>
): void {
  const available = buildAvailableSerialsAtWarehouse(
    fromWarehouseId,
    inwardRows,
    dispatchRows,
    fieldReturnRows,
    supplierRmaRows
  )

  const requestedWithSerials = requestedItems.filter((item) => (item.serialNos ?? []).length > 0)
  for (const item of requestedWithSerials) {
    const serials = (item.serialNos ?? []).map((s) => s.trim()).filter(Boolean)
    if (serials.length !== item.qty) {
      throw new Error(`Serial count for ${item.name} must match quantity.`)
    }
    const mat = normalizeMaterial(item.name)
    const bag = available.get(mat) ?? new Set<string>()
    const seen = new Set<string>()
    for (const raw of serials) {
      const sn = normalizeSerial(raw)
      if (!sn) continue
      if (seen.has(sn)) throw new Error(`Duplicate serial in dispatch payload for ${item.name}: ${raw}`)
      seen.add(sn)
      if (!bag.has(sn)) {
        throw new Error(`Serial not available at selected source warehouse for ${item.name}: ${raw}`)
      }
    }
  }
}

/**
 * When creating a return, pass `excludeReturnId` as undefined.
 * When updating return `id`, pass that id so this return’s current lines are ignored when
 * computing “still outstanding in the field” (so edited lines re-validate correctly).
 */
export function assertFieldReturnSerialsForUpsert(
  excludeReturnId: string | undefined,
  items: WarehouseItem[],
  inwardRows: Pick<MaterialInward, "items">[],
  dispatchRows: Pick<MaterialDispatch, "items">[],
  allReturns: Array<{ id: string; items: WarehouseItem[] }>
): void {
  const filtered = excludeReturnId
    ? allReturns.filter((r) => r.id !== excludeReturnId)
    : allReturns
  assertFieldReturnSerials(
    items,
    inwardRows,
    dispatchRows,
    filtered.map((r) => ({ items: r.items }))
  )
}

/** Field return: serial must currently be outstanding (dispatched and not yet returned to any warehouse). */
export function assertFieldReturnSerials(
  items: WarehouseItem[],
  inwardRows: Pick<MaterialInward, "items">[],
  dispatchRows: Pick<MaterialDispatch, "items">[],
  returnRows: Pick<MaterialReturn, "items">[]
): void {
  const withSerials = items.filter((i) => (i.serialNos ?? []).some((s) => s.trim()))
  if (withSerials.length === 0) return

  const { inwardByMaterial, dispatchedOutstandingByMaterial } = buildGlobalOutstandingSerialMaps(
    inwardRows,
    dispatchRows,
    returnRows
  )

  for (const item of withSerials) {
    const serials = (item.serialNos ?? []).map((s) => s.trim()).filter(Boolean)
    if (serials.length === 0) continue
    const mat = normalizeMaterial(item.name)
    const inwardSet = inwardByMaterial.get(mat) ?? new Set<string>()
    const outstanding = dispatchedOutstandingByMaterial.get(mat) ?? new Set<string>()
    for (const raw of serials) {
      const sn = normalizeSerial(raw)
      if (!sn) continue
      if (!inwardSet.has(sn)) {
        throw new Error(`Return serial unknown in inward history for ${item.name}: ${raw}`)
      }
      if (!outstanding.has(sn)) {
        throw new Error(
          `Return serial is not currently outstanding in the field for ${item.name}: ${raw}. It may still be at a warehouse or already returned.`
        )
      }
    }
  }
}

export function collectExistingSerialsFromInwards(
  inwardRows: Pick<MaterialInward, "id" | "items">[],
  excludeInwardId?: string
): Map<string, Set<string>> {
  const byMat = new Map<string, Set<string>>()
  for (const row of inwardRows) {
    if (excludeInwardId && row.id === excludeInwardId) continue
    for (const item of row.items ?? []) {
      const mk = normalizeMaterial(item.name)
      const set = byMat.get(mk) ?? new Set<string>()
      for (const s of item.serialNos ?? []) {
        const ns = normalizeSerial(s)
        if (ns) set.add(ns)
      }
      byMat.set(mk, set)
    }
  }
  return byMat
}

export function assertNewInwardSerialsNotDuplicates(
  items: WarehouseItem[],
  existingByMaterial: Map<string, Set<string>>
): void {
  for (const item of items) {
    const mk = normalizeMaterial(item.name)
    const existing = existingByMaterial.get(mk) ?? new Set<string>()
    for (const raw of item.serialNos ?? []) {
      const sn = normalizeSerial(raw)
      if (!sn) continue
      if (existing.has(sn)) {
        throw new Error(`Serial already exists in stock for ${item.name}: ${raw.trim()}`)
      }
    }
  }
}

export function validateInwardPayload(
  items: WarehouseItem[],
  rules: Map<string, MaterialTrackingRule>,
  existingSerialsByMaterial: Map<string, Set<string>>
): void {
  assertPayloadSerialsUnique(items)
  validateBarcodeCoverage(items, rules)
  assertNewInwardSerialsNotDuplicates(items, existingSerialsByMaterial)
}
