"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FileText, Zap, CheckCircle, FolderOpen, Users, Settings, HelpCircle, LogOut, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/contexts/role-context"
import { getAccessibleRoutes } from "@/lib/route-permissions"

// Icon mapping for route permissions
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  FileText,
  Zap,
  CheckCircle,
  FolderOpen,
  Users,
}

const generalItems = [
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Help", href: "/help", icon: HelpCircle },
  { label: "Logout", href: "/logout", icon: LogOut },
]

export function Sidebar() {
  const pathname = usePathname()
  const { role } = useRole()
  
  // Get accessible routes based on role
  const accessibleRoutes = getAccessibleRoutes(role)
  
  // Map route configs to menu items
  const menuItems = accessibleRoutes.map(route => ({
    label: route.label,
    href: route.href,
    icon: iconMap[route.icon] || FolderOpen,
  }))

  return (
    <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0 flex-col shadow-sm rounded-r-2xl">
      <div className="p-6 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-primary-button rounded-lg flex items-center justify-center text-white font-bold text-sm">
            S
          </div>
          <span className="font-bold text-foreground text-lg">SolarEPC</span>
        </Link>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-6">
        <div className="space-y-1">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">MENU</p>
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname?.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth relative",
                    isActive ? "text-primary bg-green-50" : "text-gray-600 hover:text-foreground hover:bg-gray-50",
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-primary-button rounded-r" />
                  )}
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              </Link>
            )
          })}
        </div>

        {/* General Section */}
        <div className="space-y-1 mt-8 pt-6 border-t border-gray-200">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">GENERAL</p>
          {generalItems.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-foreground hover:bg-gray-50 transition-smooth">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              </Link>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}
