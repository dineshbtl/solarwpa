"use client"

import { useState, useEffect } from "react"
import { Download, X } from "lucide-react"

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Check if the app is already installed / running in standalone mode
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return
    }

    const handler = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault()
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e)
      // Update UI to show the install button
      setShowPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    // Show the prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      console.log("User accepted the install prompt")
    } else {
      console.log("User dismissed the install prompt")
    }

    // We've used the prompt, and can't use it again
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md md:left-auto md:right-4 bg-slate-900 border border-amber-500/30 rounded-xl p-4 shadow-[0_0_20px_rgba(245,158,11,0.15)] flex items-center justify-between gap-4 animate-in slide-in-from-bottom-8 duration-300">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-500">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Install Skyvolts</h3>
          <p className="text-xs text-slate-400">Add to home screen for quick offline access</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-medium text-xs rounded-lg transition-colors cursor-pointer"
        >
          Install
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
