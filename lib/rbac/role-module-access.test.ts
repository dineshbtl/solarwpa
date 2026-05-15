import { describe, expect, it } from "vitest"
import { modulePermission, normalizeAppRole, permissionsForRole, type Role } from "@/lib/rbac"

const primaryRoles: Role[] = [
  "admin",
  "manager",
  "store_manager",
  "supervisor",
  "engineer",
  "installer",
]

describe("role module access matrix", () => {
  it("all primary roles can view dashboard and profile", () => {
    for (const role of primaryRoles) {
      const perms = permissionsForRole(role)
      expect(perms).toContain(modulePermission("dashboard", "view"))
      expect(perms).toContain(modulePermission("profile", "view"))
    }
  })

  it("engineer and installer can create installations (API enforces installer scope)", () => {
    expect(permissionsForRole("engineer")).toContain(modulePermission("installations", "create"))
    expect(permissionsForRole("installer")).toContain(modulePermission("installations", "create"))
  })

  it("supervisor and manager can edit surveys", () => {
    expect(permissionsForRole("supervisor")).toContain(modulePermission("surveys", "edit"))
    expect(permissionsForRole("manager")).toContain(modulePermission("surveys", "edit"))
  })

  it("normalizeAppRole trims and validates role strings from API", () => {
    expect(normalizeAppRole("  engineer  ")).toBe("engineer")
    expect(normalizeAppRole("invalid_role")).toBeUndefined()
    expect(normalizeAppRole(null)).toBeUndefined()
  })

  it("non-admin roles omit module delete actions by default", () => {
    const deleteLike = (perms: string[]) => perms.filter((p) => p.endsWith(".delete"))
    expect(deleteLike(permissionsForRole("manager"))).toHaveLength(0)
    expect(deleteLike(permissionsForRole("store_manager"))).toHaveLength(0)
    expect(deleteLike(permissionsForRole("engineer"))).toHaveLength(0)
    expect(deleteLike(permissionsForRole("admin")).length).toBeGreaterThan(0)
  })
})

