"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import { Menu, X, LayoutDashboard, FileText, Zap, CheckCircle, FolderOpen, Users, Package, Settings, LogOut, UserCog, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/contexts/role-context"
import { getAccessibleRoutes } from "@/lib/route-permissions"
import { hasPermissionFromMap } from "@/lib/rbac"
import { clearAppCache } from "@/lib/store/clear-cache"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  FileText,
  Zap,
  CheckCircle,
  FolderOpen,
  Users,
  Package,
  UserCog,
}

type GeneralLinkItem = {
  kind: "link"
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

type GeneralActionItem = {
  kind: "action"
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
}

type GeneralItem = GeneralLinkItem | GeneralActionItem

/** Single navigation shell: desktop column + mobile drawer (avoids duplicate MENU markup). */
export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [clearCacheOpen, setClearCacheOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { role, roleReady, permissionMap } = useRole()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    router.prefetch("/warehouse")
    router.prefetch("/warehouse/inward")
    router.prefetch("/warehouse/dispatch")
    router.prefetch("/warehouse/returns")
    router.prefetch("/warehouse/materials")
    router.prefetch("/warehouse/reallocation")
    router.prefetch("/assignments")
  }, [router])

  const accessibleRoutes = getAccessibleRoutes(role, permissionMap)
  const canViewDashboard = hasPermissionFromMap(role, "dashboard.view", permissionMap)
  const canViewSettings = hasPermissionFromMap(role, "settings.view", permissionMap)

  const generalItems: GeneralItem[] = [
    ...(canViewSettings
      ? [{ kind: "link" as const, label: "Settings", href: "/settings", icon: Settings }]
      : []),
    {
      kind: "action",
      label: "Clear cache",
      icon: Trash2,
      onClick: () => setClearCacheOpen(true),
    },
    { kind: "link", label: "Logout", href: "/logout", icon: LogOut },
  ]

  const handleConfirmClearCache = () => {
    const count = clearAppCache()
    setClearCacheOpen(false)
    toast({
      title: count === 0 ? "Cache already empty" : "Cache cleared",
      description:
        count === 0
          ? "No locally saved drafts or app state were found."
          : `Removed ${count} cached item${count === 1 ? "" : "s"}. Your sign-in is preserved.`,
    })
    router.refresh()
  }

  const menuItems = [
    ...(canViewDashboard ? [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] : []),
    ...accessibleRoutes.map((route) => ({
      label: route.label,
      href: route.href,
      icon: iconMap[route.icon] || FolderOpen,
    })),
  ]

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      <button
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="app-navigation-sidebar"
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 rounded-lg border border-border bg-background p-2 shadow-lg lg:hidden"
      >
        {mobileOpen ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" aria-hidden onClick={closeMobile} />
      ) : null}

      <aside
        id="app-navigation-sidebar"
        className={cn(
          "flex shrink-0 flex-col border-border bg-white dark:bg-sidebar lg:border-r",
          "lg:relative lg:z-0 lg:h-auto lg:w-64 lg:translate-x-0 lg:rounded-r-2xl lg:shadow-sm",
          "max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:z-40 max-lg:h-full max-lg:w-72 max-lg:rounded-none max-lg:border-r max-lg:shadow-2xl max-lg:transition-transform max-lg:duration-300",
          mobileOpen ? "max-lg:pointer-events-auto max-lg:translate-x-0" : "max-lg:pointer-events-none max-lg:-translate-x-full",
        )}
      >
        <div className={cn("border-b border-border p-6 max-lg:pt-24")}>
          <Link href="/dashboard" className="flex items-center gap-3" onClick={closeMobile}>
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary-button text-sm font-bold text-white",
                "max-lg:h-10 max-lg:w-10 max-lg:rounded-xl max-lg:text-base",
              )}
            >
              S
            </div>
            <span className="text-lg font-bold text-foreground max-lg:text-xl">SolarEPC</span>
          </Link>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-6 max-lg:p-4">
          <div className="space-y-1 max-lg:space-y-2">
            <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">MENU</p>
            {!roleReady
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={`menu-skeleton-${idx}`}
                    className="mx-1 h-10 animate-pulse rounded-lg bg-muted/60 max-lg:h-11 max-lg:rounded-xl"
                  />
                ))
              : menuItems.map((item) => {
              const Icon = item.icon
              const isActive =
                item.href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href} onClick={closeMobile}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth max-lg:rounded-xl max-lg:px-4 max-lg:py-3 max-lg:text-base",
                      isActive
                        ? "bg-gradient-dark-green text-white shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 max-lg:h-5 max-lg:w-5" />
                    <span>{item.label}</span>
                  </button>
                </Link>
              )
            })}
          </div>

          <div className="mt-8 space-y-1 border-t border-border pt-6 max-lg:mt-6 max-lg:space-y-2">
            <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">GENERAL</p>
            {generalItems.map((item) => {
              const Icon = item.icon
              const buttonClass =
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-smooth hover:bg-muted hover:text-foreground max-lg:rounded-xl max-lg:px-4 max-lg:py-3 max-lg:text-base"

              if (item.kind === "link") {
                return (
                  <Link key={item.href} href={item.href} onClick={closeMobile}>
                    <button type="button" className={buttonClass}>
                      <Icon className="h-4 w-4 max-lg:h-5 max-lg:w-5" />
                      <span>{item.label}</span>
                    </button>
                  </Link>
                )
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    closeMobile()
                    item.onClick()
                  }}
                >
                  <Icon className="h-4 w-4 max-lg:h-5 max-lg:w-5" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </aside>

      <AlertDialog open={clearCacheOpen} onOpenChange={setClearCacheOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear cached data?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes saved form drafts and other locally cached app state from this browser.
              You will stay signed in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClearCache}>Clear cache</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
