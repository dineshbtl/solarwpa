import { describe, expect, it, vi, beforeEach } from "vitest"

type Row = Record<string, any>

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/warehouse/flow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function createMockSupabaseDb() {
  const db = {
    material_inward: [] as Row[],
    material_dispatch: [] as Row[],
    material_returns: [] as Row[],
    material_master: [] as Row[],
    supplier_material_returns: [] as Row[],
    house_material_delivery: [] as Row[],
    installations: [] as Row[],
  }
  const counters: Record<string, number> = {}

  function from(table: keyof typeof db) {
    const state: {
      table: keyof typeof db
      filters: Array<(r: Row) => boolean>
      lastOp?: "select" | "insert" | "update"
      selectCols?: string
      selectLike?: { col: string; pat: string }
    } = { table, filters: [] }

    const api: any = {
      select(cols?: string) {
        state.lastOp = "select"
        state.selectCols = cols
        return api
      },
      like(col: string, pat: string) {
        state.selectLike = { col, pat }
        return api
      },
      ilike(col: string, val: string) {
        const needle = String(val).toLowerCase()
        state.filters.push((r) => String(r[col] ?? "").toLowerCase() === needle)
        return api
      },
      eq(col: string, val: any) {
        state.filters.push((r) => r[col] === val)
        return api
      },
      maybeSingle() {
        const rows = db[state.table].filter((r) => state.filters.every((f) => f(r)))
        return Promise.resolve({ data: rows[0] ?? null, error: null })
      },
      insert(row: any) {
        state.lastOp = "insert"
        const r = { ...row }
        db[state.table].push(r)
        // Return a chainable object with select().single() matching supabase-js usage
        return {
          select() {
            return {
              single() {
                return Promise.resolve({ data: r, error: null })
              },
            }
          },
        }
      },
      update(patch: any) {
        state.lastOp = "update"
        return {
          in(col: string, values: any[]) {
            let updated = false
            db[state.table] = db[state.table].map((r) => {
              if (values.includes(r[col])) {
                updated = true
                return { ...r, ...patch }
              }
              return r
            })
            return Promise.resolve({ data: updated ? db[state.table] : null, error: null })
          },
          eq(col: string, val: any) {
            const idx = db[state.table].findIndex((r) => r[col] === val)
            if (idx >= 0) db[state.table][idx] = { ...db[state.table][idx], ...patch }
            return {
              select() {
                return {
                  single() {
                    const row = db[state.table].find((r) => r[col] === val) ?? null
                    return Promise.resolve({ data: row, error: null })
                  },
                }
              },
            }
          },
        }
      },
      async then(resolve: any) {
        // Allow awaiting the query object directly: const { data, error, count } = await query
        let rows = [...db[state.table]]
        if (state.selectLike) {
          const { col, pat } = state.selectLike
          const re = new RegExp("^" + String(pat).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$")
          rows = rows.filter((r) => re.test(String(r[col] ?? "")))
        }
        if (state.filters.length) {
          rows = rows.filter((r) => state.filters.every((f) => f(r)))
        }
        resolve({ data: rows, error: null, count: rows.length })
      },
    }
    return api
  }

  const client = {
    from,
    rpc(fn: string, params: Record<string, unknown>) {
      if (fn !== "next_prefixed_id") {
        return Promise.resolve({ data: null, error: new Error(`Unsupported rpc: ${fn}`) })
      }
      const key = String(params.p_key ?? "default")
      const prefix = String(params.p_prefix ?? "")
      const width = Number(params.p_width ?? 3)
      counters[key] = (counters[key] ?? 0) + 1
      const id = `${prefix}${String(counters[key]).padStart(width, "0")}`
      return Promise.resolve({ data: id, error: null })
    },
  }

  return { db, client }
}

// Mock the server Supabase client to use an in-memory DB.
const mock = createMockSupabaseDb()
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => mock.client),
}))
vi.mock("@/lib/server/authz", () => ({
  assertModuleAction: vi.fn(async () => ({ userId: "USR-001", role: "manager" })),
  assertRoleAllowed: vi.fn(async () => ({ userId: "USR-001", role: "manager" })),
}))

describe("POST /api/warehouse/flow", () => {
  beforeEach(() => {
    mock.db.material_inward.length = 0
    mock.db.material_dispatch.length = 0
    mock.db.material_returns.length = 0
    mock.db.material_master.length = 0
    mock.db.supplier_material_returns.length = 0
    mock.db.house_material_delivery.length = 0
    mock.db.installations.length = 0
  })

  it("returns 400 when step is missing", async () => {
    const { POST } = await import("./route")
    const res = await POST(jsonRequest({ data: {} }))
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error).toMatch(/missing step/i)
  })

  it("creates inward record with INW- prefix", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      jsonRequest({
        step: "inward",
        data: {
          warehouseId: "WH-001",
          inwardDate: "2026-05-07",
          poNumber: "PO-1",
          supplierName: "Acme",
          items: [{ name: "Solar PV Module", qty: 2, unit: "Nos", serialNos: ["S1", "S2"] }],
        },
      })
    )
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.result.id).toMatch(/^INW-\d{3}$/)
    expect(mock.db.material_inward).toHaveLength(1)
  })

  it("creates dispatch record with DC- prefix", async () => {
    mock.db.material_inward.push({
      id: "INW-SEED",
      warehouse_id: "WH-001",
      items: [{ name: "Solar PV Module", qty: 2, unit: "Nos", serialNos: ["S1", "S2"] }],
    })
    const { POST } = await import("./route")
    const res = await POST(
      jsonRequest({
        step: "dispatch",
        data: {
          fromWarehouseId: "WH-001",
          toWarehouseId: "WH-002",
          dispatchDate: "2026-05-07",
          driverName: "Ravi",
          driverMobile: "9876543210",
          items: [{ name: "Solar PV Module", qty: 2, unit: "Nos", serialNos: ["S1", "S2"] }],
        },
      })
    )
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.result.id).toMatch(/^DC-\d{3}$/)
    expect(payload.result.dc_number).toBe(payload.result.id)
    expect(mock.db.material_dispatch).toHaveLength(1)
  })

  it("allocates house delivery with HDL- prefix and width 4", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      jsonRequest({
        step: "house_allocation",
        data: {
          dispatchId: "DC-001",
          toHouseholdId: "HH-001",
          materialName: "Solar PV Module",
          qty: 2,
          unit: "Nos",
          serialNos: ["S1", "S2"],
        },
      })
    )
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.result.id).toMatch(/^HDL-\d{4}$/)
    expect(mock.db.house_material_delivery).toHaveLength(1)
  })

  it("completes installation and marks matching house deliveries installed", async () => {
    // Seed an allocation first
    mock.db.house_material_delivery.push({
      id: "HDL-0001",
      to_household_id: "HH-001",
      material_name: "Solar PV Module",
      serial_nos: ["S1", "S2"],
      status: "allocated",
      installed_ref_id: null,
    })

    const { POST } = await import("./route")
    const res = await POST(
      jsonRequest({
        step: "installation_complete",
        data: {
          installationId: "INST-TEST-001",
          householdId: "HH-001",
          materialName: "Solar PV Module",
          serialNos: ["S1"],
          customerName: "Test User",
          address: "Test Address",
        },
      })
    )
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.result.id).toBe("INST-TEST-001")
    expect(payload.result.status).toBe("completed")

    const updatedDelivery = mock.db.house_material_delivery.find((r) => r.id === "HDL-0001")
    expect(updatedDelivery?.status).toBe("installed")
    expect(updatedDelivery?.installed_ref_id).toBe("INST-TEST-001")
  })
})

