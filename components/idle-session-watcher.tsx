"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const DEFAULT_IDLE_MS = 11 * 60 * 60 * 1000
const MIN_IDLE_MS = 60 * 1000
const MAX_IDLE_MS = 7 * 24 * 60 * 60 * 1000

function resolveIdleSessionMs(): number {
  const raw = process.env.NEXT_PUBLIC_IDLE_SESSION_MS?.trim()
  if (raw && /^\d+$/.test(raw)) {
    const n = Number.parseInt(raw, 10)
    if (n >= MIN_IDLE_MS && n <= MAX_IDLE_MS) return n
  }
  return DEFAULT_IDLE_MS
}

/**
 * Client-side idle timeout: signs the user out after a period without pointer/keyboard/scroll
 * activity. Default 11 hours; set NEXT_PUBLIC_IDLE_SESSION_MS (milliseconds) to override.
 */
export function IdleSessionWatcher() {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const scheduleSignOut = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        try {
          const supabase = getSupabaseBrowserClient()
          await supabase.auth.signOut()
        } catch {
          // Still redirect so the user is not stuck on a broken session
        }
        router.replace("/logout")
      }, resolveIdleSessionMs())
    }

    scheduleSignOut()

    const events = ["pointerdown", "keydown", "scroll"] as const
    const opts: AddEventListenerOptions = { capture: true, passive: true }
    for (const ev of events) {
      window.addEventListener(ev, scheduleSignOut, opts)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const ev of events) {
        window.removeEventListener(ev, scheduleSignOut, opts)
      }
    }
  }, [router])

  return null
}
