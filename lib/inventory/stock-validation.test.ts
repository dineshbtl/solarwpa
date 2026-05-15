import { describe, expect, it } from "vitest"
import {
  assertPayloadSerialsUnique,
  definitionsByMaterialKey,
  validateBarcodeCoverage,
  assertDispatchSerialsGlobally,
  buildAvailableSerialsAtWarehouse,
} from "./stock-validation"
import type { MaterialDispatch, MaterialInward, MaterialReturn, WarehouseItem } from "@/lib/store/warehouse"

describe("stock-validation", () => {
  it("assertPayloadSerialsUnique rejects duplicates", () => {
    const items: WarehouseItem[] = [{ name: "Inverter", qty: 2, serialNos: ["A", "A"] }]
    expect(() => assertPayloadSerialsUnique(items)).toThrow(/Duplicate serial/)
  })

  it("validateBarcodeCoverage allows serials-only when rule enabled (barcodes optional)", () => {
    const rules = definitionsByMaterialKey([{ name: "Solar PV Module", requiresBarcode: true, trackSerial: true }])
    const serialsOnly: WarehouseItem[] = [{ name: "Solar PV Module", qty: 2, serialNos: ["S1", "S2"] }]
    expect(() => validateBarcodeCoverage(serialsOnly, rules)).not.toThrow()

    const ok: WarehouseItem[] = [
      { name: "Solar PV Module", qty: 2, serialNos: ["S1", "S2"], barcodes: ["B1", "B2"] },
    ]
    validateBarcodeCoverage(ok, rules)

    const bad: WarehouseItem[] = [{ name: "Solar PV Module", qty: 2, serialNos: ["S1", "S2"], barcodes: ["B1"] }]
    expect(() => validateBarcodeCoverage(bad, rules)).toThrow(/barcode count/)
  })

  it("assertDispatchSerialsGlobally allows serial after field return", () => {
    const inward: Pick<MaterialInward, "items">[] = [{ items: [{ name: "Inverter", qty: 1, serialNos: ["X1"] }] }]
    const dispatch: Pick<MaterialDispatch, "items">[] = [{ items: [{ name: "Inverter", qty: 1, serialNos: ["X1"] }] }]
    const ret: Pick<MaterialReturn, "items">[] = [{ items: [{ name: "Inverter", qty: 1, serialNos: ["X1"] }] }]
    expect(() =>
      assertDispatchSerialsGlobally(
        [{ name: "Inverter", qty: 1, serialNos: ["X1"] }],
        inward,
        dispatch,
        ret,
        []
      )
    ).not.toThrow()
  })

  it("buildAvailableSerialsAtWarehouse nets inward minus dispatch from plus returns", () => {
    const inwards: MaterialInward[] = [
      {
        id: "INW-1",
        warehouseId: "WH-002",
        inwardDate: "2026-01-01",
        poNumber: "PO-1",
        items: [{ name: "Item", qty: 1, serialNos: ["A"] }],
        createdAt: "",
      },
    ]
    const dispatches: MaterialDispatch[] = [
      {
        id: "DC-1",
        fromWarehouseId: "WH-002",
        toWarehouseId: undefined,
        dcNumber: "DC-1",
        dispatchDate: "2026-01-02",
        items: [{ name: "Item", qty: 1, serialNos: ["A"] }],
        status: "dispatched",
        createdAt: "",
      },
    ]
    const avail = buildAvailableSerialsAtWarehouse("WH-002", inwards, dispatches, [], [])
    expect(avail.get("item")?.has("a")).toBe(false)
  })

  it("buildAvailableSerialsAtWarehouse removes serials when dispatch qty is 0 but serials are present", () => {
    const inwards: MaterialInward[] = [
      {
        id: "INW-1",
        warehouseId: "WH-002",
        inwardDate: "2026-01-01",
        poNumber: "PO-1",
        items: [{ name: "Item", qty: 1, serialNos: ["A"] }],
        createdAt: "",
      },
    ]
    const dispatches: MaterialDispatch[] = [
      {
        id: "DC-1",
        fromWarehouseId: "WH-002",
        toWarehouseId: undefined,
        dcNumber: "DC-1",
        dispatchDate: "2026-01-02",
        items: [{ name: "Item", qty: 0, serialNos: ["A"] }],
        status: "dispatched",
        createdAt: "",
      },
    ]
    const avail = buildAvailableSerialsAtWarehouse("WH-002", inwards, dispatches, [], [])
    expect(avail.get("item")?.has("a")).toBe(false)
  })

  it("buildAvailableSerialsAtWarehouse treats missing fromWarehouseId as default WH-002 for outbound serials", () => {
    const inwards: MaterialInward[] = [
      {
        id: "INW-1",
        warehouseId: "WH-002",
        inwardDate: "2026-01-01",
        poNumber: "PO-1",
        items: [{ name: "Item", qty: 1, serialNos: ["A"] }],
        createdAt: "",
      },
    ]
    const dispatches: MaterialDispatch[] = [
      {
        id: "DC-1",
        fromWarehouseId: undefined,
        toWarehouseId: undefined,
        dcNumber: "DC-1",
        dispatchDate: "2026-01-02",
        items: [{ name: "Item", qty: 1, serialNos: ["A"] }],
        status: "dispatched",
        createdAt: "",
      },
    ]
    const atDefault = buildAvailableSerialsAtWarehouse("WH-002", inwards, dispatches, [], [])
    expect(atDefault.get("item")?.has("a")).toBe(false)

    const atOther = buildAvailableSerialsAtWarehouse("WH-001", inwards, dispatches, [], [])
    expect(atOther.get("item")).toBeUndefined()
  })
})
