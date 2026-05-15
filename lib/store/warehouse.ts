export type WarehouseType = "state" | "district"

export type WarehouseStockCategory = "distribution" | "maintenance"

export type Warehouse = {
  id: string
  name: string
  warehouseType: WarehouseType
  location?: string
  inChargeId?: string
  /** distribution = DC stock; maintenance = O&M / truck spares pool */
  stockCategory?: WarehouseStockCategory
  createdAt: string
}

/**
 * Default warehouse id used when no user/cache preference is available.
 * Mirrors the seed in db/migrations/00013_installations_warehouse_roles.sql.
 */
export const DEFAULT_WAREHOUSE_ID = "WH-002"

/** Matches DB seed in db/migrations/00013_installations_warehouse_roles.sql — used if ids differ per env. */
export const KURNOOL_CENTRAL_WAREHOUSE_NAME = "Kurnool Central Warehouse"

/** Prefer WH-002, then name match for Kurnool DC, else first warehouse in the list. */
export function resolveDefaultWarehouseId(warehouses: Warehouse[]): string {
  if (!warehouses.length) return DEFAULT_WAREHOUSE_ID
  const byCode = warehouses.find((w) => w.id === DEFAULT_WAREHOUSE_ID)
  if (byCode) return byCode.id
  const needle = KURNOOL_CENTRAL_WAREHOUSE_NAME.toLowerCase()
  const byName = warehouses.find((w) => w.name.trim().toLowerCase() === needle)
  if (byName) return byName.id
  return warehouses[0].id
}

/**
 * Seeded fallback list — keep in sync with migration 00013. Components render with this list
 * immediately on hard refresh (or when `warehouses` API is slow) so the dropdown is never empty.
 */
export const DEFAULT_WAREHOUSES: Warehouse[] = [
  {
    id: "WH-001",
    name: "Hyderabad Central Store",
    warehouseType: "state",
    location: "Hyderabad, Telangana",
    stockCategory: "distribution",
    createdAt: "",
  },
  {
    id: "WH-002",
    name: KURNOOL_CENTRAL_WAREHOUSE_NAME,
    warehouseType: "district",
    location: "Kurnool, Andhra Pradesh",
    stockCategory: "distribution",
    createdAt: "",
  },
]

export type DispatchStatus = "draft" | "dispatched" | "received"

export type WarehouseItem = {
  name: string
  qty: number
  unit?: string
  serialNos?: string[]
  /** One barcode per serial when material.requiresBarcode — wedge / camera scan */
  barcodes?: string[]
  batchNo?: string
  notes?: string
}

export type MaterialInward = {
  id: string
  warehouseId?: string
  inwardDate: string
  poNumber: string
  refNo?: string
  supplierName?: string
  items: WarehouseItem[]
  photoUrl?: string
  photoGps?: {
    latitude: number
    longitude: number
    source?: "exif" | "device" | "manual"
  }
  notes?: string
  createdBy?: string
  createdAt: string
}

export type MaterialDispatch = {
  id: string
  fromWarehouseId?: string
  toWarehouseId?: string
  dcNumber: string
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
  status: DispatchStatus
  createdAt: string
}

export type ReceiptStatus = "received_full" | "partial" | "shortage"

export type MaterialReceipt = {
  id: string
  dispatchId: string
  receivedBy?: string
  receivedDate: string
  receiptStatus: ReceiptStatus
  itemsReceived: WarehouseItem[]
  shortageNotes?: string
  createdAt: string
}

export type VillageIssueItem = {
  name: string
  qtyPerHh: number
  totalQty: number
  unit?: string
  serialNos?: string[]
}

export type VillageIssueTemplateItem = {
  name: string
  qtyPerHh: number
  unit?: string
}

export type MaterialIssueVillage = {
  id: string
  projectId?: string
  fromWarehouseId?: string
  mandal: string
  villageName: string
  householdsApproved: number
  issueChallanNo: string
  issueDate: string
  issuedBy?: string
  items: VillageIssueItem[]
  notes?: string
  createdAt: string
}

export type VillageAllotment = {
  id: string
  projectId?: string
  mandal: string
  villageName: string
  engineerId?: string
  householdsAllotted?: number
  allottedDate?: string
  notes?: string
  createdAt: string
}

export type MaterialReturn = {
  id: string
  projectId?: string
  fromVillage?: string
  toWarehouseId?: string
  returnDate: string
  returnReason: "excess" | "installation_cancelled" | "damaged"
  returnedBy?: string
  items: WarehouseItem[]
  notes?: string
  createdAt: string
}

export type SupplierRmaStatus = "draft" | "sent_to_supplier" | "credited" | "closed"

/** Damaged / excess units shipped back to vendor (separate from village field returns). */
export type SupplierMaterialReturn = {
  id: string
  fromWarehouseId?: string
  poNumber: string
  supplierName?: string
  returnDate: string
  status: SupplierRmaStatus
  items: WarehouseItem[]
  notes?: string
  createdBy?: string
  createdAt: string
}

export type HouseMaterialDeliveryStatus = "allocated" | "delivered" | "returned" | "reassigned" | "installed"

export type HouseMaterialDelivery = {
  id: string
  allocationBatchId?: string
  dispatchId?: string
  fromEntityType: "warehouse" | "household" | "vehicle"
  fromEntityId?: string
  toHouseholdId: string
  materialName: string
  qty: number
  unit?: string
  serialNos: string[]
  status: HouseMaterialDeliveryStatus
  proofPhotoUrl?: string
  proofPhotoGps?: {
    latitude: number
    longitude: number
    source?: "exif" | "device" | "manual"
  }
  deliveredBy?: string
  notes?: string
  installedRefId?: string
  createdAt: string
  updatedAt?: string
}

export type HouseMaterialMovementEvent = {
  id: string
  deliveryId?: string
  eventType: "allocate" | "allocate_request" | "deliver" | "return_cancelled" | "reassign" | "reassign_request" | "install"
  fromHouseholdId?: string
  toHouseholdId?: string
  materialName: string
  serialNos: string[]
  qty: number
  proofPhotoUrl?: string
  proofPhotoGps?: {
    latitude: number
    longitude: number
    source?: "exif" | "device" | "manual"
  }
  notes?: string
  actorId?: string
  approvalStatus?: "pending" | "approved" | "rejected"
  approvedBy?: string
  approvedAt?: string
  requestPayload?: Record<string, unknown>
  rejectionReason?: string
  createdAt: string
}

/** Auto-calculate village issue items based on household count */
export function calcVillageIssueItems(
  households: number,
  templates: VillageIssueTemplateItem[]
): VillageIssueItem[] {
  return templates.map((item) => ({
    name: item.name,
    qtyPerHh: item.qtyPerHh,
    totalQty: households * item.qtyPerHh,
    unit: item.unit,
  }))
}
