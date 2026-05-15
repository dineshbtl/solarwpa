import {
  materialAllowsSerialOrBarcode,
  materialUsesLengthInsteadOfSerial,
  materialUsesPanelSerialSet,
  materialUsesQuantity,
} from '@/lib/installation-material-options'

/** Stable unique id per material line (avoids duplicate `MAT-${n}` after removals → React key bugs). */
export function createMaterialLineId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `MAT-${crypto.randomUUID()}`
  }
  return `MAT-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Normalize serial for duplicate checks (trim + lowercase). */
export function normalizeSerial(serial: string): string {
  return serial.trim().toLowerCase()
}

export function isDuplicateSerial(
  serial: string,
  materials: { id: string; serialNumber: string }[],
  excludeMaterialId?: string
): boolean {
  const n = normalizeSerial(serial)
  if (!n) return false
  return materials.some(
    (m) => m.id !== excludeMaterialId && normalizeSerial(m.serialNumber) === n
  )
}

/** Barcode must be unique when non-empty (same barcode on two items is treated as duplicate). */
export function isDuplicateBarcode(
  barcode: string,
  materials: { id: string; barcode: string }[],
  excludeMaterialId?: string
): boolean {
  const b = barcode.trim()
  if (!b) return false
  return materials.some((m) => m.id !== excludeMaterialId && m.barcode.trim() === b)
}

export function normalizeBarcode(barcode: string): string {
  return barcode.trim().toLowerCase()
}

/** True if this barcode is already used on another line or another panel slot. */
/** Solar PV row: each of the four panel slots must have a serial and/or a barcode. */
export function solarPanelLineHasAllIdentifiers(m: {
  panelSerials?: string[]
  panelBarcodes?: string[]
}): boolean {
  for (let i = 0; i < 4; i++) {
    const s = (m.panelSerials?.[i] ?? "").trim()
    const b = (m.panelBarcodes?.[i] ?? "").trim()
    if (!s && !b) return false
  }
  return true
}

export function isDuplicateBarcodeAnywhere(
  barcode: string,
  materials: { id: string; name: string; barcode: string; panelBarcodes?: string[] }[],
  excludeMaterialId: string,
  excludePanelIndex?: number
): boolean {
  const n = normalizeBarcode(barcode)
  if (!n) return false
  for (const m of materials) {
    if (materialUsesPanelSerialSet(m.name)) {
      const pcs = m.panelBarcodes ?? []
      for (let i = 0; i < pcs.length; i++) {
        if (m.id === excludeMaterialId && excludePanelIndex === i) continue
        if (normalizeBarcode(pcs[i] ?? "") === n) return true
      }
    } else {
      if (m.id === excludeMaterialId) continue
      if (normalizeBarcode(m.barcode) === n) return true
    }
  }
  return false
}

/** Returns error message or null. Ignores completely empty rows (no type, serial, barcode, or length). */
export function validateMaterialsList(
  materials: {
    name: string
    serialNumber: string
    barcode: string
    lengthMeters?: string
    panelSerials?: string[]
    panelBarcodes?: string[]
    quantity?: number | string
  }[]
): string | null {
  const quantityValue = (quantity: number | string | undefined): number => {
    if (typeof quantity === 'number') return Number.isFinite(quantity) ? quantity : 0
    if (typeof quantity === 'string') {
      const parsed = Number(quantity.trim())
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }

  const effective = materials.filter((m) => {
    if (materialUsesPanelSerialSet(m.name)) {
      return (
        m.name.trim() ||
        (m.panelSerials ?? []).some((s) => s.trim()) ||
        (m.panelBarcodes ?? []).some((b) => b.trim()) ||
        m.barcode.trim()
      )
    }
    if (materialUsesQuantity(m.name)) {
      return m.name.trim() || quantityValue(m.quantity) > 0
    }
    return (
      m.name.trim() ||
      m.serialNumber.trim() ||
      m.barcode.trim() ||
      String(m.lengthMeters ?? '').trim()
    )
  })
  if (effective.length === 0) {
    return 'Materials step: add at least one row, pick a material type, then fill serial/barcode (or cable "length m" / kit quantity).'
  }
  for (let lineIdx = 0; lineIdx < effective.length; lineIdx++) {
    const m = effective[lineIdx]
    if (!m.name.trim()) {
      return `Materials step — item ${lineIdx + 1}: choose a material type from the dropdown.`
    }
    if (materialUsesPanelSerialSet(m.name)) {
      const serials = m.panelSerials ?? []
      const barcodes = m.panelBarcodes ?? []
      for (let i = 0; i < 4; i++) {
        const s = (serials[i] ?? "").trim()
        const b = (barcodes[i] ?? "").trim()
        if (!s && !b) {
          return `Solar PV Module — panel ${i + 1}: enter a serial number or a barcode (either is enough). This slot is still empty.`
        }
      }
      continue
    }
    if (materialUsesQuantity(m.name)) {
      if (quantityValue(m.quantity) < 1) {
        return `${m.name}: enter quantity (at least 1).`
      }
      continue
    }
    if (materialUsesLengthInsteadOfSerial(m.name)) {
      if (!String(m.lengthMeters ?? "").trim()) {
        return `${m.name}: enter length in meters (cables/wire do not use serial numbers).`
      }
    } else if (materialAllowsSerialOrBarcode(m.name)) {
      if (!m.serialNumber.trim() && !m.barcode.trim()) {
        return `${m.name}: enter a serial number or a barcode — one of them is required (you can use only the barcode).`
      }
    } else if (!m.serialNumber.trim()) {
      return `${m.name}: enter a serial number (this material type does not accept barcode-only).`
    }
  }
  const sns = effective
    .flatMap((m) => {
      if (materialUsesPanelSerialSet(m.name)) {
        return (m.panelSerials ?? []).map((s) => normalizeSerial(s))
      }
      if (materialUsesLengthInsteadOfSerial(m.name)) return []
      if (materialUsesQuantity(m.name)) return []
      return [normalizeSerial(m.serialNumber)]
    })
    .filter(Boolean)
  if (new Set(sns).size !== sns.length) {
    return "Materials step: duplicate serial number — each serial must be unique across every material line (including all four panel slots)."
  }
  const bcs = effective.flatMap((m) => {
    if (materialUsesPanelSerialSet(m.name)) {
      return (m.panelBarcodes ?? []).map((b) => normalizeBarcode(b)).filter(Boolean)
    }
    if (materialUsesQuantity(m.name)) return []
    const one = normalizeBarcode(m.barcode)
    return one ? [one] : []
  })
  if (new Set(bcs).size !== bcs.length) {
    return "Materials step: duplicate barcode — each barcode must be unique (inverter line + all panel barcode slots)."
  }
  return null
}
