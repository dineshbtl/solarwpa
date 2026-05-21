"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"

export default function OfflineFallback() {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsReady(true)
  }, [])

  if (!isReady) return null

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4 text-center font-sans">
      <div className="max-w-md rounded-2xl bg-amber-50 p-8 text-amber-950 shadow-xl border border-amber-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-200 mb-6 shadow-inner">
          <Spinner className="h-8 w-8 text-amber-700" />
        </div>
        <h1 className="text-2xl font-bold mb-3 tracking-tight">You're Offline</h1>
        <p className="mb-8 text-amber-800/80 leading-relaxed">
          The application could not reach the server. Tap the button below to access your offline data.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link 
            href="/dashboard" 
            className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold shadow-md hover:from-green-700 hover:to-green-800 transition-all text-sm"
          >
            Open Offline Dashboard
          </Link>
          <button 
            onClick={() => window.location.reload()} 
            className="px-5 py-2.5 bg-amber-200/50 text-amber-900 rounded-xl font-semibold shadow-sm hover:bg-amber-200 transition-all text-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    </div>
  )
}
