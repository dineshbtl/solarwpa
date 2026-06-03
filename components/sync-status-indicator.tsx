"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, CloudLightning, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { offlineDB } from "@/lib/data/offline-db"
import { processSyncQueue } from "@/lib/data/sync"

export function SyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [mutations, setMutations] = useState<any[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return

    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      handleRefresh()
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Initial load
    handleRefresh()

    // Subscribe to OfflineDB change notifications
    const unsubscribe = offlineDB.subscribe(() => {
      handleRefresh()
    })

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      unsubscribe()
    }
  }, [])

  const handleRefresh = async () => {
    try {
      const pending = await offlineDB.getPendingMutations()
      setPendingCount(pending.length)
      setMutations(pending)
    } catch (e) {
      console.error("[SyncStatusIndicator] Failed to read pending mutations:", e)
    }
  }

  const triggerManualSync = async () => {
    if (!isOnline) return
    setSyncing(true)
    try {
      await processSyncQueue()
      await handleRefresh()
    } catch (e) {
      console.error("[SyncStatusIndicator] Manual sync failed:", e)
    } finally {
      setSyncing(false)
    }
  }

  // Choose the visual theme based on current status
  const getStatusConfig = () => {
    if (!isOnline) {
      if (pendingCount > 0) {
        return {
          bg: "bg-amber-950/90 border-amber-800 text-amber-200",
          text: `${pendingCount} pending sync (Offline)`,
          icon: <WifiOff className="h-4 w-4 text-amber-400" />,
        }
      }
      return {
        bg: "bg-slate-900/90 border-slate-700 text-slate-300",
        text: "Offline Mode",
        icon: <WifiOff className="h-4 w-4 text-slate-500" />,
      }
    }

    if (syncing || pendingCount > 0) {
      return {
        bg: "bg-blue-950/90 border-blue-800 text-blue-200",
        text: syncing ? "Syncing changes..." : `${pendingCount} changes syncing`,
        icon: <RefreshCw className={`h-4 w-4 text-blue-400 ${syncing || pendingCount > 0 ? "animate-spin" : ""}`} />,
      }
    }

    return {
      bg: "bg-emerald-950/90 border-emerald-800 text-emerald-200",
      text: "All synced",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    }
  }

  const status = getStatusConfig()

  if (pendingCount === 0 && isOnline) {
    // Keep it completely unobtrusive when online and fully synced
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 font-sans select-none">
      <div 
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border shadow-lg backdrop-blur-md cursor-pointer transition-all duration-300 transform hover:scale-105 ${status.bg}`}
      >
        {status.icon}
        <span className="text-sm font-semibold tracking-wide">{status.text}</span>
        {isOnline && pendingCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              triggerManualSync()
            }}
            disabled={syncing}
            className="ml-1 p-1 rounded-full hover:bg-white/10 transition-colors"
            title="Sync Now"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {showDetails && pendingCount > 0 && (
        <div className="w-72 bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-lg animate-in slide-in-from-bottom-2 duration-200 text-slate-100">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Outbox</h4>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-300 font-semibold">{pendingCount} items</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {mutations.map((mut) => (
              <div key={mut.id} className="text-xs p-2 rounded-lg bg-slate-950/50 border border-slate-900/50 flex items-start justify-between">
                <div>
                  <span className="font-semibold text-slate-200 capitalize">{mut.storeName.replace(/s$/, '')}</span>
                  <span className="mx-1.5 text-slate-500">•</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    mut.action === 'CREATE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                    mut.action === 'UPDATE' ? 'bg-blue-950 text-blue-400 border border-blue-900' :
                    'bg-amber-950 text-amber-400 border border-amber-900'
                  }`}>{mut.action}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {mut.createdAt ? new Date(mut.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))}
          </div>
          {isOnline && (
            <button
              onClick={triggerManualSync}
              disabled={syncing}
              className="mt-3 w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold rounded-xl text-xs transition-all duration-150 shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Outbox Now"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
