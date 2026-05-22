"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { WifiOff } from "lucide-react"

export default function OfflineFallback() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsReady(true)
    
    // Automatically reload the page when the browser comes back online
    const handleOnline = () => {
      window.location.reload()
    }
    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [])

  if (!isReady) return null

  return (
    <div className="min-h-screen relative p-4 sm:p-6 lg:p-8">
      {/* Subtle Offline Indicator */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          <WifiOff className="h-4 w-4" />
          <span>Waiting for network...</span>
        </div>
      </div>

      {/* Generic App Shell Skeletons */}
      <div className="rounded-2xl bg-white shadow-sm border border-border p-4 sm:p-6 space-y-6">
        <div className="border border-border rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <Skeleton className="h-6 w-64 mb-3" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="border border-border rounded-xl p-4 sm:p-6 space-y-4">
            <Skeleton className="h-6 w-40 mb-6" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[80%]" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
          
          <div className="border border-border rounded-xl p-4 sm:p-6 space-y-4">
            <Skeleton className="h-6 w-40 mb-6" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[85%]" />
              <Skeleton className="h-4 w-[95%]" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
