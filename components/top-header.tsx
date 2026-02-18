"use client"

import { useEffect, useState } from "react"
import { Bell, Search, Mail, UserCog } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useRole } from "@/contexts/role-context"
import type { Role } from "@/lib/rbac"
import { roleLabel } from "@/lib/rbac"

const ROLES: Role[] = ["surveyor", "manager", "engineer", "government", "admin"]

export function TopHeader() {
  const { role, setRole } = useRole()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="sticky top-0 z-40 bg-gradient-topbar border-b border-border">
      <div className="flex h-16 items-center justify-between px-8">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search task" className="pl-9 bg-white border-border text-sm rounded-xl" />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-6 ml-auto">
          <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-transparent">
            <Mail className="w-5 h-5" />
          </Button>

          <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-transparent">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
          </Button>

          {/* Role dropdown: render only after mount to avoid Radix ID hydration mismatch */}
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

          {/* User profile dropdown: render only after mount to avoid Radix ID hydration mismatch */}
          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent">
                  <div className="w-9 h-9 bg-gradient-to-br from-red-400 to-red-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                    TM
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 text-sm">
                  <p className="font-semibold text-foreground">Totok Michael</p>
                  <p className="text-muted-foreground text-xs">tmichael20@gmail.com</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => {
                  e.preventDefault()
                  window.location.href = "/logout"
                }}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" type="button" tabIndex={-1}>
              <div className="w-9 h-9 bg-gradient-to-br from-red-400 to-red-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                TM
              </div>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
