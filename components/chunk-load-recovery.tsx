"use client"

import { useEffect } from "react"

const RELOAD_GUARD_KEY = "solar-epc:chunk-reload-once"

function shouldRecoverFromError(input: unknown): boolean {
  const text = input instanceof Error ? input.message : typeof input === "string" ? input : ""
  if (!text) return false
  return (
    text.includes("ChunkLoadError") ||
    text.includes("Loading chunk") ||
    text.includes("Failed to fetch dynamically imported module")
  )
}

function reloadOnceForChunkFailure() {
  if (typeof window === "undefined") return
  try {
    if (window.sessionStorage.getItem(RELOAD_GUARD_KEY) === "1") return
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, "1")
  } catch {
    // Safari Private / ITP may block storage — still attempt reload once for chunk errors.
  }
  window.location.reload()
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const target = event.target as HTMLElement | null
      const failedScriptSrc =
        target instanceof HTMLScriptElement ? target.src : target instanceof HTMLLinkElement ? target.href : ""

      if (failedScriptSrc.includes("/_next/static/chunks/")) {
        reloadOnceForChunkFailure()
        return
      }

      if (shouldRecoverFromError(event.error) || shouldRecoverFromError(event.message)) {
        reloadOnceForChunkFailure()
      }
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (shouldRecoverFromError(event.reason)) {
        reloadOnceForChunkFailure()
      }
    }

    window.addEventListener("error", onError, true)
    window.addEventListener("unhandledrejection", onUnhandledRejection)
    return () => {
      window.removeEventListener("error", onError, true)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
    }
  }, [])

  return null
}
