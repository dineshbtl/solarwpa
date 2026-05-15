/**
 * AbortController-backed fetch wrapper for client-side /api/* save calls.
 *
 * The Supabase browser client has its own `fetchWithTimeout` (see lib/supabase/client.ts)
 * scoped to supabase-js requests; this one wraps direct calls to our Next.js route handlers
 * so the submit `finally {}` block can always run and the save spinner can never get stuck.
 *
 * On timeout we throw a friendly Error that callers can surface to a toast. The user's local
 * form draft is intentionally NOT cleared on timeout — useFormDraft handles persistence.
 */
const DEFAULT_TIMEOUT_MS = 30_000

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  // Respect caller-provided signal: if they already abort, we don't add a second controller.
  if (init.signal) {
    return fetch(input, init)
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: ctrl.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const seconds = Math.round(timeoutMs / 1000)
      throw new Error(
        `Server did not respond within ${seconds}s. Your changes are saved locally — please try again in a moment.`,
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
