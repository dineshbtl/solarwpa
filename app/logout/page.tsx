"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

function useSupabaseAuth() {
  if (typeof window === "undefined") return null
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const { getSupabaseBrowserClient } = require("@/lib/supabase/client")
      return getSupabaseBrowserClient()
    }
  } catch {
    // env not set
  }
  return null
}

export default function LogoutPage() {
  const router = useRouter()
  const supabase = useSupabaseAuth()

  useEffect(() => {
    async function doLogout() {
      if (supabase) await supabase.auth.signOut()
      router.replace("/")
      router.refresh()
    }
    doLogout()
  }, [supabase, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Signing out…</p>
    </div>
  )
}
