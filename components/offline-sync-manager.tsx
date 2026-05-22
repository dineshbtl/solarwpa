"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRole } from "@/contexts/role-context"
import { listSurveys } from "@/lib/data/surveys"
import { listInstallations } from "@/lib/data/installations"
import { listInspections } from "@/lib/data/inspections"

export function OfflineSyncManager() {
  const { hasSession, currentUser } = useRole()
  const router = useRouter()

  useEffect(() => {
    // Only trigger full sync if the user is logged in and the browser is online
    if (hasSession && currentUser?.id && typeof navigator !== "undefined" && navigator.onLine) {
      console.log("[Offline Sync Manager] Triggering background sync of all critical data...")
      
      // 1. Aggressively prefetch Next.js routes so Workbox caches the RSC payloads for offline navigation
      const routesToPrefetch = [
        "/dashboard",
        "/surveys",
        "/installations",
        "/inspections",
        "/warehouse",
        "/profile"
      ]
      
      routesToPrefetch.forEach((route) => {
        try {
          router.prefetch(route)
        } catch (e) {
          // ignore prefetch errors
        }
      })

      // 2. Fire and forget - silently pre-cache everything into IndexedDB
      // We run these concurrently but catch errors so they don't break the UI
      Promise.allSettled([
        listSurveys(),
        listInstallations(),
        listInspections()
      ]).then((results) => {
        console.log("[Offline Sync Manager] Background sync complete.", results)
      })
    }
  }, [hasSession, currentUser?.id])

  // This component doesn't render anything visible
  return null
}
