import { describe, expect, it } from "vitest"
import type { Permission, Role } from "@/lib/rbac"
import { ROLE_PERMISSIONS } from "@/lib/rbac"
import { canAccessRoute, INSTALLATIONS_CREATE_PERMISSIONS } from "@/lib/route-permissions"

function cloneRoleMap(): Record<Role, Permission[]> {
  const out = {} as Record<Role, Permission[]>
  for (const [k, v] of Object.entries(ROLE_PERMISSIONS)) {
    out[k as Role] = [...v]
  }
  return out
}

describe("canAccessRoute create flows", () => {
  it("denies /installations/new when role lacks create permissions", () => {
    expect(canAccessRoute("store_manager", "/installations/new", null)).toBe(false)
    const map = cloneRoleMap()
    map.store_manager = map.store_manager.filter(
      (p) => !INSTALLATIONS_CREATE_PERMISSIONS.includes(p as (typeof INSTALLATIONS_CREATE_PERMISSIONS)[number]),
    )
    expect(canAccessRoute("store_manager", "/installations/new", map)).toBe(false)
  })

  it("allows /installations/new when role has installations.create", () => {
    expect(canAccessRoute("engineer", "/installations/new", null)).toBe(true)
  })

  it("allows /installations/new when role has legacy create_installations only", () => {
    const map = cloneRoleMap()
    map.engineer = ["create_installations", "dashboard.view"]
    expect(canAccessRoute("engineer", "/installations/new", map)).toBe(true)
  })

  it("still allows list route /installations with view permission only", () => {
    expect(canAccessRoute("store_manager", "/installations", null)).toBe(true)
  })

  it("matches longer paths before parent /installations", () => {
    expect(canAccessRoute("engineer", "/installations/some-id/edit", null)).toBe(true)
  })
})

describe("hasAnyPermissionFromMap (via route)", () => {
  it("installations list permission does not imply create route access", () => {
    const map = cloneRoleMap()
    map.store_manager = ["installations.view", "dashboard.view", "profile.view"]
    expect(canAccessRoute("store_manager", "/installations/new", map)).toBe(false)
    expect(canAccessRoute("store_manager", "/installations", map)).toBe(true)
  })
})
