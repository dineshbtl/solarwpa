"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, LayoutDashboard, FileText, Zap, CheckCircle, FolderOpen, Users, Settings, HelpCircle, LogOut } from "lucide-react"
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
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Help", href: "/help", icon: HelpCircle },
  { label: "Logout", href: "/logout", icon: LogOut },
]

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
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
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
      >
        {isOpen ? <X className="w-6 h-6 text-gray-700" /> : <Menu className="w-6 h-6 text-gray-700" />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-40 transform transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-6 border-b border-gray-200 mt-16">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setIsOpen(false)}>
            <div className="w-10 h-10 bg-gradient-primary-button rounded-xl flex items-center justify-center text-white font-bold">
              S
            </div>
            <span className="font-bold text-foreground text-xl">SolarEPC</span>
          </Link>
        </div>

        <nav className="p-4">
          <div className="space-y-2">
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">MENU</p>
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname?.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-smooth relative",
                      isActive ? "text-primary bg-green-50" : "text-gray-600 hover:text-foreground hover:bg-gray-50",
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-primary-button rounded-r" />
                    )}
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                </Link>
              )
            })}
          </div>
        </nav>
      </aside>
    </>
  )
}
