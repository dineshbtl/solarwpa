"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ClipboardList, MapPin, Package, Wrench, CheckCircle, BarChart3, Bell, Settings, User } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
    roles: ["surveyor", "manager", "government"],
  },
  {
    title: "Site Surveys",
    href: "/surveys",
    icon: MapPin,
    roles: ["surveyor", "manager"],
  },
  {
    title: "Approvals",
    href: "/approvals",
    icon: ClipboardList,
    roles: ["manager"],
  },
  {
    title: "Material Dispatch",
    href: "/dispatch",
    icon: Package,
    roles: ["manager"],
  },
  {
    title: "Installations",
    href: "/installations",
    icon: Wrench,
    roles: ["surveyor", "manager"],
  },
  {
    title: "Inspections",
    href: "/inspections",
    icon: CheckCircle,
    roles: ["manager", "government"],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["manager"],
  },
]

export function AppNav({ userRole = "surveyor" }: { userRole?: string }) {
  const pathname = usePathname()

  const filteredItems = navItems.filter((item) => item.roles.includes(userRole))

  return (
    <nav className="bg-[#2d2d2d] text-white min-h-screen w-64 p-6 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">SolarEPC</h1>
        <p className="text-sm text-neutral-400">Installation Manager</p>
      </div>

      <div className="flex-1 space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive ? "bg-[#e8b44f] text-[#2d2d2d] font-medium" : "text-neutral-300 hover:bg-[#3d3d3d]",
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </div>

      <div className="border-t border-neutral-700 pt-4 space-y-1">
        <Button variant="ghost" className="w-full justify-start text-neutral-300 hover:bg-[#3d3d3d]">
          <Bell className="w-5 h-5 mr-3" />
          Notifications
        </Button>
        <Button variant="ghost" className="w-full justify-start text-neutral-300 hover:bg-[#3d3d3d]">
          <Settings className="w-5 h-5 mr-3" />
          Settings
        </Button>
        <Button variant="ghost" className="w-full justify-start text-neutral-300 hover:bg-[#3d3d3d]">
          <User className="w-5 h-5 mr-3" />
          Profile
        </Button>
      </div>
    </nav>
  )
}
