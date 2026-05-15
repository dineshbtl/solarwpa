import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAssertModuleAction = vi.fn()
const mockCreateSurveyWithServiceRole = vi.fn()
const mockGetNextSurveyId = vi.fn()
const mockBuildUploadsFromFormData = vi.fn()
const mockUpdateSurveyWithServiceRole = vi.fn()
const mockUpdateSurveyStatusWithServiceRole = vi.fn()
const mockAssignSurveyInstallerWithServiceRole = vi.fn()

vi.mock("@/lib/server/authz", () => ({
  assertModuleAction: mockAssertModuleAction,
}))

vi.mock("@/lib/supabase/surveys-server", () => ({
  createSurveyWithServiceRole: mockCreateSurveyWithServiceRole,
  getNextSurveyId: mockGetNextSurveyId,
  buildUploadsFromFormData: mockBuildUploadsFromFormData,
  updateSurveyWithServiceRole: mockUpdateSurveyWithServiceRole,
  updateSurveyStatusWithServiceRole: mockUpdateSurveyStatusWithServiceRole,
  assignSurveyInstallerWithServiceRole: mockAssignSurveyInstallerWithServiceRole,
}))

describe("Survey API routes", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAssertModuleAction.mockResolvedValue({ userId: "USR-001", role: "manager" })
  })

  it("POST /api/surveys/create creates survey on success", async () => {
    const created = { id: "SUR-123", status: "pending" }
    mockGetNextSurveyId.mockResolvedValue("SUR-123")
    mockBuildUploadsFromFormData.mockResolvedValue({})
    mockCreateSurveyWithServiceRole.mockResolvedValue(created)

    const { POST } = await import("./create/route")
    const formData = new FormData()
    formData.set("input", JSON.stringify({ beneficiaryName: "A", serviceNo: "S-1" }))
    formData.set("siteDetails", JSON.stringify({}))
    const req = new Request("http://localhost/api/surveys/create", { method: "POST", body: formData })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.survey).toEqual(created)
    expect(mockAssertModuleAction).toHaveBeenCalledWith(req, "surveys", "create")
  })

  it("POST /api/surveys/create returns 403 for disallowed role", async () => {
    mockAssertModuleAction.mockResolvedValue({ userId: "USR-009", role: "installer" })
    const { POST } = await import("./create/route")
    const formData = new FormData()
    formData.set("input", JSON.stringify({ beneficiaryName: "A", serviceNo: "S-1" }))
    const req = new Request("http://localhost/api/surveys/create", { method: "POST", body: formData })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const payload = await res.json()
    expect(String(payload.error)).toMatch(/forbidden/i)
  })

  it("POST /api/surveys/update updates survey on success", async () => {
    const updated = { id: "SUR-123", status: "approved" }
    mockBuildUploadsFromFormData.mockResolvedValue({})
    mockUpdateSurveyWithServiceRole.mockResolvedValue(updated)

    const { POST } = await import("./update/route")
    const formData = new FormData()
    formData.set("id", "SUR-123")
    formData.set("input", JSON.stringify({ beneficiaryName: "A", serviceNo: "S-1" }))
    formData.set("siteDetails", JSON.stringify({}))
    const req = new Request("http://localhost/api/surveys/update", { method: "POST", body: formData })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.survey).toEqual(updated)
    expect(mockAssertModuleAction).toHaveBeenCalledWith(req, "surveys", "edit")
  })

  it("POST /api/surveys/create returns 400 when input is missing", async () => {
    const { POST } = await import("./create/route")
    const req = new Request("http://localhost/api/surveys/create", { method: "POST", body: new FormData() })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("POST /api/surveys/update returns 400 when id is missing", async () => {
    const { POST } = await import("./update/route")
    const formData = new FormData()
    formData.set("input", JSON.stringify({ beneficiaryName: "A", serviceNo: "S-1" }))
    const req = new Request("http://localhost/api/surveys/update", { method: "POST", body: formData })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("POST /api/surveys/status updates status for supervisor", async () => {
    mockAssertModuleAction.mockResolvedValue({ userId: "USR-002", role: "supervisor" })
    mockUpdateSurveyStatusWithServiceRole.mockResolvedValue({ id: "SUR-100", status: "approved" })

    const { POST } = await import("./status/route")
    const req = new Request("http://localhost/api/surveys/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surveyId: "SUR-100", status: "approved" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.survey.status).toBe("approved")
  })

  it("POST /api/surveys/status blocks installer role", async () => {
    mockAssertModuleAction.mockResolvedValue({ userId: "USR-005", role: "installer" })
    const { POST } = await import("./status/route")
    const req = new Request("http://localhost/api/surveys/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surveyId: "SUR-100", status: "approved" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("POST /api/surveys/status returns 400 when payload fields are missing", async () => {
    const { POST } = await import("./status/route")
    const req = new Request("http://localhost/api/surveys/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surveyId: "SUR-100" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("POST /api/surveys/installer assigns installer", async () => {
    mockAssertModuleAction.mockResolvedValue({ userId: "USR-002", role: "engineer" })
    mockAssignSurveyInstallerWithServiceRole.mockResolvedValue({ id: "SUR-101", installerId: "USR-010" })

    const { POST } = await import("./installer/route")
    const req = new Request("http://localhost/api/surveys/installer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surveyId: "SUR-101", installerId: "USR-010" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.survey.installerId).toBe("USR-010")
  })

  it("POST /api/surveys/installer returns 400 when surveyId is missing", async () => {
    const { POST } = await import("./installer/route")
    const req = new Request("http://localhost/api/surveys/installer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installerId: "USR-010" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
