"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { Permission, Role } from "@/lib/rbac"
import { hasPermissionFromMap, normalizeAppRole, permissionsForRoleFromMap, ROLES_LIST } from "@/lib/rbac"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getCurrentProfile } from "@/lib/data/users"
import type { User } from "@/lib/store/users"

const STORAGE_KEY = "solarepc.currentRole"
/** Cached permission map keyed per-Supabase-deployment to keep hard refresh menus stable. */
const PERMISSION_MAP_STORAGE_KEY = "solarepc.permissionMap"
/** Lightweight cache of the last resolved profile so hard refresh shows the right menu before profile reload. */
const CURRENT_USER_STORAGE_KEY = "solarepc.currentUser"
const LOCATION_PROMPT_PREFIX = "solarepc.locationPromptedForUser"
const LOCATION_ATTEMPT_PREFIX = "solarepc.locationAttemptedForUser"

function readCachedRole(): Role | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return ROLES_LIST.includes(raw as Role) ? (raw as Role) : null
  } catch {
    return null
  }
}

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

function writeCachedUser(user: User | null): void {
  if (typeof window === "undefined") return
  try {
    if (user) {
      window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user))
    } else {
      window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY)
    }
  } catch {
    // localStorage unavailable / quota — ignore
  }
}

function readCachedPermissionMap(): Record<Role, Permission[]> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(PERMISSION_MAP_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, Permission[]>
    if (!parsed || typeof parsed !== "object") return null
    const next = {} as Record<Role, Permission[]>
    for (const r of ROLES_LIST) {
      if (Array.isArray(parsed[r])) next[r] = parsed[r]
    }
    return Object.keys(next).length > 0 ? next : null
  } catch {
    return null
  }
}

function writeCachedPermissionMap(map: Record<Role, Permission[]> | null): void {
  if (typeof window === "undefined") return
  try {
    if (map) {
      window.localStorage.setItem(PERMISSION_MAP_STORAGE_KEY, JSON.stringify(map))
    } else {
      window.localStorage.removeItem(PERMISSION_MAP_STORAGE_KEY)
    }
  } catch {
    // ignore
  }
}

const RoleContext = createContext<{
  role: Role
  roleReady: boolean
  /** true once we've verified whether a Supabase session exists; null while still checking. */
  hasSession: boolean | null
  setRole: (role: Role) => void
  canApproveSurveys: boolean
  currentUser: User | null
  permissionMap: Record<Role, Permission[]> | null
  resolvePermissionsForRole: (userRole: Role) => Permission[]
  refreshPermissionMap: () => Promise<void>
}>({
  role: "surveyor",
  roleReady: false,
  hasSession: null,
  setRole: () => {},
  canApproveSurveys: false,
  currentUser: null,
  permissionMap: null,
  resolvePermissionsForRole: (r) => permissionsForRoleFromMap(r, null),
  refreshPermissionMap: async () => {},
})

export function RoleProvider({ children }: { children: React.ReactNode }) {
  // Initial state matches server-rendered output to avoid hydration mismatch; the useEffect below
  // immediately hydrates with cached values so the menu reappears on hard refresh without waiting
  // for the network.
  const [role, setRoleState] = useState<Role>("surveyor")
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const [permissionMap, setPermissionMap] = useState<Record<Role, Permission[]> | null>(null)
  // `roleResolved` flips to true when we have authoritative role info — either because we read
  // it synchronously from localStorage, or because the async profile/permission load finished
  // (with or without a session). Until then, the sidebar shows skeletons instead of flashing
  // the surveyor default menu on first hard refresh.
  const [roleResolved, setRoleResolved] = useState(false)
  // null = still checking. true/false = we've verified whether a Supabase session is present.
  // The RouteGuard uses this to decide whether to redirect to login.
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  const loadPermissionMap = useCallback(async () => {
    const { listRolePermissionsFromSupabase } = await import("@/lib/supabase/role-permissions")
    const map = await listRolePermissionsFromSupabase()
    setPermissionMap(map)
    writeCachedPermissionMap(map)
  }, [])

  const requestLocationPermission = useCallback(async (userId?: string) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return
    if (!userId) return

    try {
      const promptKey = `${LOCATION_PROMPT_PREFIX}:${userId}`
      const attemptKey = `${LOCATION_ATTEMPT_PREFIX}:${userId}`
      const alreadyAttempted = sessionStorage.getItem(attemptKey) === "1"
      if (alreadyAttempted) return

      if ("permissions" in navigator && typeof navigator.permissions.query === "function") {
        const status = await navigator.permissions.query({ name: "geolocation" })
        if (status.state === "granted" || status.state === "denied") {
          sessionStorage.setItem(promptKey, "1")
          sessionStorage.setItem(attemptKey, "1")
          return
        }
      }

      sessionStorage.setItem(attemptKey, "1")
      navigator.geolocation.getCurrentPosition(
        () => {
          // User allowed location access.
          sessionStorage.setItem(promptKey, "1")
        },
        () => {
          // User dismissed/denied or location unavailable.
          sessionStorage.removeItem(attemptKey)
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      )
    } catch {
      // Ignore permission API or storage issues.
    }
  }, [])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false

    // Hydrate from cache synchronously so the sidebar/menu re-appears the moment the client
    // mounts, even before Supabase finishes loading the profile and permission map.
    const cachedRole = readCachedRole()
    const cachedUser = readCachedUser()
    const cachedPerms = readCachedPermissionMap()
    if (cachedRole) setRoleState(cachedRole)
    if (cachedUser) setCurrentUser(cachedUser)
    if (cachedPerms) setPermissionMap(cachedPerms)
    setMounted(true)
    // Only mark role as resolved up-front when we actually have a cached role — otherwise
    // hold the skeleton state until the async profile/permission load below completes, so
    // the menu does not flash a default surveyor view on first hard refresh.
    if (cachedRole) setRoleResolved(true)

    const run = async () => {
      if (isSupabaseConfigured()) {
        try {
          const { getSupabaseBrowserClient } = await import("@/lib/supabase/client")
          const { waitForSessionReady } = await import("@/lib/supabase/auth")
          const supabase = getSupabaseBrowserClient()

          // Determine whether a session actually exists; this drives the RouteGuard redirect.
          const sessionCheck = (async () => {
            const session = await waitForSessionReady()
            if (cancelled) return
            setHasSession(!!session)
          })()

          const refreshProfile = async () => {
            try {
              const profile = await getCurrentProfile()
              if (cancelled) return
              if (profile) {
                const safeRole = normalizeAppRole(profile.role) ?? "surveyor"
                const merged = { ...profile, role: safeRole }
                setCurrentUser(merged)
                setRoleState(safeRole)
                try {
                  window.localStorage.setItem(STORAGE_KEY, safeRole)
                } catch {
                  // ignore quota / unavailable
                }
                writeCachedUser(merged)
              }
              // If profile lookup returns null but we still have a Supabase session, keep the cached
              // user/role so hard refresh doesn't downgrade an admin sidebar to a surveyor default.
            } catch {
              // Session may exist without a profile row yet — keep cached menu intact.
            }
          }

          // Run all three in parallel: session check, permission map, profile fetch.
          await Promise.allSettled([sessionCheck, loadPermissionMap(), refreshProfile()])
          if (!cancelled) setRoleResolved(true)

          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange(async (event, session) => {
            // INITIAL_SESSION fires once after the client hydrates the session from localStorage.
            // We refresh the profile so a hard refresh that races ahead of session hydration still
            // ends up with the correct role + sidebar.
            if (event === "INITIAL_SESSION") {
              if (!cancelled) setHasSession(!!session)
            }
            if (
              event === "INITIAL_SESSION" ||
              event === "SIGNED_IN" ||
              event === "TOKEN_REFRESHED" ||
              event === "USER_UPDATED"
            ) {
              if (session?.user?.id) {
                if (!cancelled) setHasSession(true)
                await refreshProfile()
              }
            }
            if (event === "SIGNED_IN") {
              await requestLocationPermission(session?.user?.id)
            }
            if (event === "SIGNED_OUT") {
              if (cancelled) return
              setCurrentUser(null)
              setRoleState("surveyor")
              setPermissionMap(null)
              setHasSession(false)
              writeCachedUser(null)
              writeCachedPermissionMap(null)
              try {
                window.localStorage.removeItem(STORAGE_KEY)
              } catch {
                // ignore
              }
            }
          })
          unsubscribe = () => subscription.unsubscribe()
        } catch {
          // missing env at runtime, etc. — still mark resolved so we render *something*
          if (!cancelled) setRoleResolved(true)
        }
      } else {
        try {
          const stored = readCachedRole()
          if (stored) setRoleState(stored)
          const cachedUser = readCachedUser()
          if (cachedUser) setCurrentUser(cachedUser)
        } catch {
          // ignore
        }
        if (!cancelled) setRoleResolved(true)
      }
    }

    void run()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [loadPermissionMap, requestLocationPermission])

  useEffect(() => {
    if (!mounted || !currentUser?.id) return
    void requestLocationPermission(currentUser.id)
  }, [mounted, currentUser?.id, requestLocationPermission])

  const setRole = useCallback((newRole: Role) => {
    setRoleState(newRole)
    try {
      window.localStorage.setItem(STORAGE_KEY, newRole)
    } catch {
      // ignore
    }
  }, [])

  const resolvePermissionsForRole = useCallback(
    (userRole: Role) => permissionsForRoleFromMap(userRole, permissionMap),
    [permissionMap],
  )

  const canApproveSurveys = hasPermissionFromMap(role, "approve_surveys", permissionMap)

  if (!mounted) {
    return (
      <RoleContext.Provider
        value={{
          role: "surveyor",
          roleReady: false,
          hasSession: null,
          setRole: () => {},
          canApproveSurveys: false,
          currentUser: null,
          permissionMap: null,
          resolvePermissionsForRole: (r) => permissionsForRoleFromMap(r, null),
          refreshPermissionMap: async () => {},
        }}
      >
        {children}
      </RoleContext.Provider>
    )
  }

  return (
    <RoleContext.Provider
      value={{
        role,
        roleReady: roleResolved,
        hasSession,
        setRole,
        canApproveSurveys,
        currentUser,
        permissionMap,
        resolvePermissionsForRole,
        refreshPermissionMap: loadPermissionMap,
      }}
    >
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const ctx = useContext(RoleContext)
  return ctx!
}
