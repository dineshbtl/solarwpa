"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { TopHeader } from "@/components/top-header"
import { MobileNav } from "@/components/mobile-nav"
import { RoleProvider, useRole } from "@/contexts/role-context"
import { canAccessRoute } from "@/lib/route-permissions"

function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { role, currentUser } = useRole()

  useEffect(() => {
    const publicPages = ["/", "/signup", "/logout", "/login"]
    if (publicPages.includes(pathname)) return

    if (!currentUser) return

    // Block inactive users — sign out and redirect to login
    if (currentUser.status === "inactive") {
      router.push("/logout")
      return
    }

    if (!canAccessRoute(role, pathname)) {
      router.push("/dashboard")
    }
  }, [pathname, role, currentUser, router])

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
      <RouteGuard>
        <div className="flex h-screen">
          <MobileNav />
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="hidden lg:block">
              <TopHeader />
            </div>
            <main className="flex-1 overflow-y-auto bg-page pt-16 lg:pt-0 overscroll-none">{children}</main>
          </div>
        </div>
      </RouteGuard>
    </RoleProvider>
  )
}
