import { describe, expect, it } from "vitest"
import {
  solarPanelLineHasAllIdentifiers,
  validateMaterialsList,
} from "@/lib/installation-material-validation"

describe("solarPanelLineHasAllIdentifiers", () => {
  it("accepts four barcodes only", () => {
    expect(
      solarPanelLineHasAllIdentifiers({
        panelSerials: ["", "", "", ""],
        panelBarcodes: ["B1", "B2", "B3", "B4"],
      })
    ).toBe(true)
  })

  it("accepts mixed serial and barcode per slot", () => {
    expect(
      solarPanelLineHasAllIdentifiers({
        panelSerials: ["S1", "", "S3", ""],
        panelBarcodes: ["", "B2", "", "B4"],
      })
    ).toBe(true)
  })

  it("rejects when one slot has neither", () => {
    expect(
      solarPanelLineHasAllIdentifiers({
        panelSerials: ["S1", "S2", "", ""],
        panelBarcodes: ["", "", "", ""],
      })
    ).toBe(false)
  })
})

describe("validateMaterialsList", () => {
  it("allows inverter with barcode only", () => {
    expect(
      validateMaterialsList([
        {
          name: "Inverter",
          serialNumber: "",
          barcode: "INV-BC-001",
        },
      ])
    ).toBeNull()
  })

  it("rejects inverter with neither serial nor barcode", () => {
    const msg = validateMaterialsList([
      { name: "Inverter", serialNumber: "", barcode: "  " },
    ])
    expect(msg).toContain("Inverter")
    expect(msg).toContain("serial")
    expect(msg).toContain("barcode")
  })

  it("allows solar PV with barcodes only on all four panels", () => {
    expect(
      validateMaterialsList([
        {
          name: "Solar PV Module",
          serialNumber: "",
          barcode: "",
          panelSerials: ["", "", "", ""],
          panelBarcodes: ["P1", "P2", "P3", "P4"],
        },
      ])
    ).toBeNull()
  })

  it("reports which panel is missing id", () => {
    const msg = validateMaterialsList([
      {
        name: "Solar PV Module",
        serialNumber: "",
        barcode: "",
        panelSerials: ["A", "B", "", ""],
        panelBarcodes: ["", "", "", ""],
      },
    ])
    expect(msg).toContain("panel 3")
  })

  it("still requires serial for mounting structure", () => {
    const msg = validateMaterialsList([
      {
        name: "Mounting Structure",
        serialNumber: "",
        barcode: "ONLY-BC",
      },
    ])
    expect(msg).toContain("Mounting Structure")
    expect(msg).toContain("serial number")
    expect(msg).toContain("barcode-only")
  })

  it("detects duplicate serials across lines", () => {
    const msg = validateMaterialsList([
      { name: "Mounting Structure", serialNumber: "X1", barcode: "" },
      { name: "ACDB Box & DCDB Box", serialNumber: "X1", barcode: "" },
    ])
    expect(msg).toContain("duplicate serial")
  })
})
