import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { listProjects } from './projects'
import { listUsers } from './users'
import { listSurveys } from './surveys'
import { listInstallations } from './installations'
import { listInspections } from './inspections'
import { toast } from '@/hooks/use-toast'

let warmupPromise: Promise<void> | null = null

const APP_ROUTES = [
  '/dashboard',
  '/surveys',
  '/installations',
  '/inspections',
  '/assignments/survey-installers',
  '/profile',
  '/settings',
  '/warehouse'
]

export async function warmupOfflineData(force = false): Promise<void> {
  if (typeof window === 'undefined') return
  if (!navigator.onLine) return

  if (warmupPromise && !force) return warmupPromise

  warmupPromise = (async () => {
    console.log('[Offline Warmup] Starting offline data warmup...')
    toast({
      title: "Offline Syncing",
      description: "Downloading resources for offline availability...",
    })

    try {
      const results = await Promise.allSettled([
        listUsers(),
        listProjects(),
        listSurveys(),
        listInstallations(),
        listInspections()
      ])

      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        console.warn('[Offline Warmup] Some resources failed to sync:', failed)
        toast({
          title: "Offline Sync Partial",
          description: "Some data could not be fully pre-cached for offline use.",
          variant: "destructive"
        })
      } else {
        console.log('[Offline Warmup] All resources synced successfully!')
        toast({
          title: "Offline Ready",
          description: "All pages and data are now available offline.",
        })
      }
    } catch (err) {
      console.error('[Offline Warmup] Error during warmup:', err)
      toast({
        title: "Offline Sync Failed",
        description: "Could not prepare all data for offline use.",
        variant: "destructive"
      })
    } finally {
      warmupPromise = null
    }
  })()

  return warmupPromise
}

export function useOfflineWarmup(enabled = true) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !navigator.onLine) return

    // 1. Run database records warmup
    void warmupOfflineData()

    // 2. Prefetch JS chunks and document shells for all major routes in the background
    const warmupRoutes = async () => {
      for (const route of APP_ROUTES) {
        // Prefetch client-side Next.js bundles
        try {
          router.prefetch(route)
        } catch (e) {
          console.warn(`Failed to prefetch route ${route}:`, e)
        }

        // Fetch HTML document and RSC payload so they get cached by the Service Worker
        try {
          // HTML page
          void fetch(route, { method: 'GET', credentials: 'same-origin' }).catch(() => {})
          
          // RSC payload
          void fetch(`${route}?_rsc=1`, { 
            method: 'GET', 
            headers: { 'RSC': '1' }, 
            credentials: 'same-origin' 
          }).catch(() => {})
        } catch (e) {
          // Ignore fetch network/CORS issues in background prewarming
        }
      }
    }

    // Delay slightly to not compete with critical initial page load resources
    const timeout = setTimeout(() => {
      void warmupRoutes()
    }, 2000)

    return () => clearTimeout(timeout)
  }, [router])
}
