/** Preset material names for installation forms (single source of truth — from BOM image). */
export const MATERIAL_NAME_OPTIONS = [
  "Solar PV Module",
  "Inverter",
  "Mounting Structure",
  "Bolts Set",
  "DC Cable 4.0 Sqmm Black",
  "DC Cable 4.0 Sqmm Red & Black",
  "Earthing Wire 16 Sqmm Green",
  "ACDB Box & DCDB Box",
  "MC4 Connectors Pack",
  "45x45 PVC Channel",
  "PVC Pipe",
  "1-inch Flexible Pipe",
  "AC Cable Red",
  "AC Cable Red & Black",
  "Earthing Kit",
  "Conduit Kit",
] as const

export type MaterialNameOption = (typeof MATERIAL_NAME_OPTIONS)[number]

/** Cables / earthing wire: tracked by length (m) instead of serial number. */
export const MATERIAL_TYPES_USE_LENGTH_METERS = [
  "DC Cable 4.0 Sqmm Black",
  "DC Cable 4.0 Sqmm Red & Black",
  "Earthing Wire 16 Sqmm Green",
  "AC Cable Red",
  "AC Cable Red & Black",
] as const

/** Kit items tracked by quantity count (no serial number). */
export const MATERIAL_TYPES_USE_QUANTITY = [
  "Bolts Set",
  "MC4 Connectors Pack",
  "45x45 PVC Channel",
  "PVC Pipe",
  "1-inch Flexible Pipe",
  "Earthing Kit",
  "Conduit Kit",
] as const

export function materialUsesLengthInsteadOfSerial(name: string): boolean {
  return (MATERIAL_TYPES_USE_LENGTH_METERS as readonly string[]).includes(name)
}

export function materialUsesQuantity(name: string): boolean {
  return (MATERIAL_TYPES_USE_QUANTITY as readonly string[]).includes(name)
}

export const SOLAR_PANEL_TYPE = "Solar PV Module"

export const INVERTER_TYPE = "Inverter" as const

export function materialUsesPanelSerialSet(name: string): boolean {
  return name === SOLAR_PANEL_TYPE
}

/** Serial or barcode alone is enough (barcode satisfies the line). */
export function materialAllowsSerialOrBarcode(name: string): boolean {
  return name === INVERTER_TYPE
}

/** Default quantity for each BOM material (for Load All BOM feature). */
export const BOM_DEFAULT_QUANTITIES: Partial<Record<string, number | string>> = {
  "Solar PV Module": 1,
  "Inverter": 1,
  "Mounting Structure": 1,
  "Bolts Set": 1,
  "DC Cable 4.0 Sqmm Black": "10",
  "DC Cable 4.0 Sqmm Red & Black": "10",
  "Earthing Wire 16 Sqmm Green": "25",
  "ACDB Box & DCDB Box": 1,
  "MC4 Connectors Pack": 1,
  "45x45 PVC Channel": 1,
  "PVC Pipe": 8,
  "1-inch Flexible Pipe": 1,
  "AC Cable Red": "3",
  "AC Cable Red & Black": "3",
  "Earthing Kit": 1,
  "Conduit Kit": 1,
}
