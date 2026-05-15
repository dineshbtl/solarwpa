import type React from "react"

import { SettingsSidebar } from "@/components/settings/settings-sidebar"

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:min-h-[calc(100dvh-8rem)]">
      <SettingsSidebar />
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  )
}
