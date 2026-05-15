"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

/** App-side caches written by RoleContext / TopHeader / shared stores. Wipe on logout. */
const APP_CACHE_KEYS = [
  "solarepc.currentRole",
  "solarepc.permissionMap",
  "solarepc.currentUser",
]

function clearAppCaches() {
  if (typeof window === "undefined") return
  try {
    for (const key of APP_CACHE_KEYS) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // localStorage unavailable — ignore
  }
}

export default function LogoutPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function doLogout() {
      try {
        const supabase = getSupabaseBrowserClient()
        
        // Sign out with a timeout to prevent hanging
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000))
        const signOutPromise = supabase.auth.signOut()
        
        await Promise.race([signOutPromise, timeoutPromise])
        clearAppCaches()
        
        // Always redirect, even if sign out failed
        if (isMounted) {
          router.replace("/")
          router.refresh()
        }
      } catch (err) {
        // If anything fails, still clear local caches + redirect to home
        clearAppCaches()
        if (isMounted) {
          router.replace("/")
          router.refresh()
        }
      }
    }

    doLogout()

    return () => {
      isMounted = false
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Signing out…</p>
      </div>
    </div>
  )
}
