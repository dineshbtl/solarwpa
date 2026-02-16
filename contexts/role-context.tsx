"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { Role } from "@/lib/rbac"
import { hasPermission } from "@/lib/rbac"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getCurrentProfile, listUsers } from "@/lib/data/users"
import type { User } from "@/lib/store/users"

const STORAGE_KEY = "solarepc.currentRole"

const RoleContext = createContext<{
  role: Role
  setRole: (role: Role) => void
  canApproveSurveys: boolean
  currentUser: User | null
}>({
  role: "surveyor",
  setRole: () => {},
  canApproveSurveys: false,
  currentUser: null,
})

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("surveyor")
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (isSupabaseConfigured()) {
      getCurrentProfile()
        .then((profile) => {
          if (profile) {
            setCurrentUser(profile)
            if (profile.role) setRoleState(profile.role as Role)
          }
        })
        .catch(() => {})
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEY) as Role | null
        if (stored && ["admin", "manager", "engineer", "surveyor", "government"].includes(stored)) {
          setRoleState(stored)
        }
        const roleToUse = stored && ["admin", "manager", "engineer", "surveyor", "government"].includes(stored) ? stored : "surveyor"
        listUsers().then((users) => {
          const user = users.find((u) => u.role === roleToUse) ?? users[0] ?? null
          setCurrentUser(user)
        })
      } catch {
        // ignore
      }
    }
    setMounted(true)
  }, [])

  const setRole = useCallback((newRole: Role) => {
    setRoleState(newRole)
    try {
      localStorage.setItem(STORAGE_KEY, newRole)
    } catch {
      // ignore
    }
  }, [])

  const canApproveSurveys = hasPermission(role, "approve_surveys")

  if (!mounted) {
    return (
      <RoleContext.Provider value={{ role: "surveyor", setRole: () => {}, canApproveSurveys: false, currentUser: null }}>
        {children}
      </RoleContext.Provider>
    )
  }

  return (
    <RoleContext.Provider value={{ role, setRole, canApproveSurveys, currentUser }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const ctx = useContext(RoleContext)
  return ctx!
}
