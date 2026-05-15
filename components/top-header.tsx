"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getCurrentProfileFromSupabase } from "@/lib/supabase/users"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { waitForSessionReady } from "@/lib/supabase/auth"
import type { User } from "@/lib/store/users"
import Link from "next/link"

const CURRENT_USER_STORAGE_KEY = "solarepc.currentUser"

function readCachedUser(): User | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as User
    if (!parsed || typeof parsed !== "object" || !parsed.id) return null
    return parsed
  } catch {
    return null
  }
}

export function TopHeader() {
  const [mounted, setMounted] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  const toFallbackUser = (authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): User => {
    const fallbackName =
      String(authUser.user_metadata?.full_name ?? "").trim() ||
      String(authUser.email ?? "").split("@")[0] ||
      "User"
    return {
      id: authUser.id,
      name: fallbackName,
      email: authUser.email ?? "",
      role: "surveyor",
      status: "active",
      createdAt: new Date().toISOString(),
    }
  }

  useEffect(() => {
    setMounted(true)
    // Hydrate avatar/name from cache so the header stays populated across hard refreshes.
    const cached = readCachedUser()
    if (cached) setCurrentUser(cached)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadUser() {
      try {
        // Wait for Supabase to restore the session from localStorage before reading the user;
        // otherwise the first call after a hard refresh returns null and the avatar shows "?".
        const session = await waitForSessionReady()
        if (cancelled) return
        let authUser = session?.user ?? null
        if (!authUser) {
          const sb = getSupabaseBrowserClient()
          const { data: authData } = await sb.auth.getUser()
          authUser = authData.user
        }
        if (!authUser) {
          // No active session — only clear if we don't already have a cached user (avoid flashing
          // an empty header during a slow session restore).
          if (!cancelled && !readCachedUser()) setCurrentUser(null)
          return
        }
        if (!cancelled) setCurrentUser((prev) => prev ?? toFallbackUser(authUser!))

        const user = await getCurrentProfileFromSupabase()
        if (user && !cancelled) {
          setCurrentUser(user)
        }
      } catch (err) {
        const abortLike =
          (err instanceof Error && (err.name === "AbortError" || /aborted without reason/i.test(err.message))) ||
          (typeof err === "string" && /aborted without reason/i.test(err))
        if (abortLike) return
        console.error("Error loading user:", err)
      }
    }
    loadUser()
    return () => {
      cancelled = true
    }
  }, [])

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border">
      <div className="flex h-16 items-center justify-between px-8">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search task" className="pl-9 bg-background border-border text-sm rounded-xl" />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-6 ml-auto">
          {/* <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-transparent">
            <Mail className="w-5 h-5" />
          </Button> */}

          {/* <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-transparent">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
          </Button> */}

          {/* Role dropdown: DISABLED - role switching commented out */}
          {/*
          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-border bg-white">
                  <UserCog className="w-4 h-4" />
                  <span className="hidden sm:inline">{roleLabel(role)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">View as role</div>
                {ROLES.map((r) => (
                  <DropdownMenuItem key={r} onClick={() => setRole(r)}>
                    {roleLabel(r)}
                    {r === role ? " ✓" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" className="gap-2 border-border bg-white" type="button" tabIndex={-1}>
              <UserCog className="w-4 h-4" />
              <span className="hidden sm:inline">{roleLabel(role)}</span>
            </Button>
          )}
          */}

          {/* User profile dropdown: render only after mount to avoid Radix ID hydration mismatch */}
          {mounted ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent">
                  <div className="w-9 h-9 bg-gradient-to-br from-red-400 to-red-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                    {currentUser ? getInitials(currentUser.name) : "?"}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 text-sm">
                  <p className="font-semibold text-foreground">{currentUser?.name || "User"}</p>
                  <p className="text-muted-foreground text-xs">{currentUser?.email || "No email"}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => {
                  e.preventDefault()
                  window.location.href = "/logout"
                }}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" type="button" tabIndex={-1}>
              <div className="w-9 h-9 bg-gradient-to-br from-red-400 to-red-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                ?
              </div>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
