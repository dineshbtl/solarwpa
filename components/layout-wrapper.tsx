"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { TopHeader } from "@/components/top-header"
import { MobileNav } from "@/components/mobile-nav"
import { RoleProvider } from "@/contexts/role-context"

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublicPage = pathname === "/" || pathname === "/signup" || pathname === "/logout"

  if (isPublicPage) {
    return <>{children}</>
  }

  return (
    <RoleProvider>
      <div className="flex h-screen">
        <MobileNav />
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="hidden lg:block">
            <TopHeader />
          </div>
          <main className="flex-1 overflow-auto bg-background pt-16 lg:pt-0">{children}</main>
        </div>
      </div>
    </RoleProvider>
  )
}
