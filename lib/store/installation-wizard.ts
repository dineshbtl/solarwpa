/** Draft save/restore helpers for installation wizard */

const DRAFT_PREFIX = "solarepc.installation_draft."

export type WizardDraft = {
  step: number
  visitType?: string
  arrivalTime?: string
  departureTime?: string
  siteAccessible?: boolean
  siteLat?: number
  siteLng?: number
  surveyId?: string
  customerName?: string
  address?: string
  engineerId?: string
  engineerName?: string
  installationChecklist?: Record<string, boolean>
  commissioningData?: Record<string, unknown>
  qualityCheck?: Record<string, unknown>
  faultReport?: Record<string, unknown>
  declarationConfirmed?: boolean
  /** When site was not accessible */
  inaccessibleNote?: string
  savedAt?: string
}

export function saveDraft(installationId: string, draft: WizardDraft): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(DRAFT_PREFIX + installationId, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }))
  } catch {}
}

export function loadDraft(installationId: string): WizardDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + installationId)
    if (!raw) return null
    return JSON.parse(raw) as WizardDraft
  } catch {
    return null
  }
}

export function clearDraft(installationId: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(DRAFT_PREFIX + installationId)
  } catch {}
}
