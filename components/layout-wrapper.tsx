"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { IdleSessionWatcher } from "@/components/idle-session-watcher"
import { Sidebar } from "@/components/sidebar"
import { TopHeader } from "@/components/top-header"
import { RoleProvider, useRole } from "@/contexts/role-context"
import { canAccessRoute, getAccessibleRoutes } from "@/lib/route-permissions"
import { hasPermissionFromMap } from "@/lib/rbac"
import { useOfflineWarmup } from "@/lib/data/warmup"

function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { role, currentUser, permissionMap, roleReady, hasSession } = useRole()

  // Proactively warm up and cache all pages/data for offline use when online
  useOfflineWarmup(hasSession === true)

  useEffect(() => {
    const publicPages = ["/", "/signup", "/logout", "/login"]
    if (publicPages.includes(pathname)) return

    // Wait until RoleProvider has authoritative role info (cache or completed network call).
    // Without this we can bounce users in the brief async hydration window on hard refresh.
    if (!roleReady) return

    // Authoritative session check: only redirect to login once we've actually verified the
    // Supabase session is missing (hasSession === false). While still checking (null) or
    // when a session exists (true), leave the user where they are.
    if (hasSession === false) {
      router.replace("/")
      return
    }

    // From here on we either have a session or we don't know yet; only act on the
    // permission/inactive checks when we have a hydrated profile to make a decision from.
    if (!currentUser) return

    if (currentUser.status === "inactive") {
      router.push("/logout")
      return
    }

    if (!canAccessRoute(role, pathname, permissionMap)) {
      if (hasPermissionFromMap(role, "dashboard.view", permissionMap)) {
        router.push("/dashboard")
        return
      }

      const firstAllowed = getAccessibleRoutes(role, permissionMap)[0]
      if (firstAllowed) {
        router.push(firstAllowed.href)
        return
      }

      router.push("/logout")
    }
  }, [pathname, role, currentUser, router, permissionMap, roleReady, hasSession])

  return <>{children}</>
}

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublicPage = pathname === "/" || pathname === "/signup" || pathname === "/logout"

  if (isPublicPage) {
    return <>{children}</>
  }

  return (
    <RoleProvider>
      <IdleSessionWatcher />
      <RouteGuard>
        <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden bg-page">
          <Sidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="hidden lg:block">
              <TopHeader />
            </div>
            <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-page pt-16 lg:pt-0 [-webkit-overflow-scrolling:touch]">
              {children}
            </main>
          </div>
        </div>
      </RouteGuard>
    </RoleProvider>
  )
}
