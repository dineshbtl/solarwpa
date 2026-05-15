import type { SurveyActivityEvent } from "@/lib/store/surveys"

/** Latest survey activity entry where an installer was assigned or cleared (by assignment workflow). */
export function latestInstallerAssignedFromSurveyActivity(activity: unknown): { at: string; actorId?: string } | null {
  if (!Array.isArray(activity)) return null
  let best: SurveyActivityEvent | null = null
  for (const raw of activity) {
    if (!raw || typeof raw !== "object") continue
    const ev = raw as SurveyActivityEvent
    if (ev.action !== "installer_assigned") continue
    if (!best || new Date(ev.at).getTime() >= new Date(best.at).getTime()) best = ev
  }
  if (!best) return null
  return { at: best.at, actorId: best.actorId }
}
