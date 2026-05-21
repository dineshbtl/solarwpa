"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { describeAuthSignInError, normalizeLoginEmail } from "@/lib/auth-login"
import { requestDeviceLocationPermission } from "@/lib/geolocation"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, UserStatus } from "@/lib/supabase/database.types"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

function useDeferredSupabaseClient(): {
  client: SupabaseClient<Database> | null
  /** False only for one tick when Supabase is configured — avoids treating real login as demo before client exists. */
  authReady: boolean
} {
  const [client, setClient] = useState<SupabaseClient<Database> | null>(null)
  const [authReady, setAuthReady] = useState(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return !(url && key)
  })
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      setAuthReady(true)
      return
    }
    try {
      setClient(getSupabaseBrowserClient())
    } catch (e) {
      console.warn("[login] Supabase browser client failed to initialize", e)
    } finally {
      setAuthReady(true)
    }
  }, [])
  return { client, authReady }
}

/** Read post-login redirect without `useSearchParams` (avoids Next.js static/streaming + Suspense edge cases on `/`). */
function getLoginRedirectPath(): string | null {
  if (typeof window === "undefined") return null
  const raw = new URLSearchParams(window.location.search).get("redirectTo")
  return raw && raw.startsWith("/") ? raw : null
}

/** Same on server and client – use for UI that must not hydration-mismatch. */
function isSupabaseConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export default function LoginPage() {
  return <LoginPageContent />
}

function LoginPageContent() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showLocationPrompt, setShowLocationPrompt] = useState(false)
  const { client: supabase, authReady } = useDeferredSupabaseClient()
  const supabaseConfigured = isSupabaseConfigured()

  useEffect(() => {
    if (!supabase) return

    const cachedUser = typeof window !== "undefined" ? window.localStorage.getItem("solarepc.currentUser") : null

    // If completely offline and we have a cached user, skip the network hang and redirect immediately
    if (typeof navigator !== "undefined" && !navigator.onLine && cachedUser) {
      router.replace("/dashboard")
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard")
      }
    }).catch((e) => {
      // If session fetch fails (e.g., timeout due to flaky network) but we have a cached user,
      // assume we are offline and let them into the app.
      if (cachedUser) {
        router.replace("/dashboard")
      }
    })
  }, [supabase, router])

  const continueAfterLocationPrompt = () => {
    router.push(getLoginRedirectPath() ?? "/dashboard")
    router.refresh()
  }

  const handleLocationDecision = async (allow: boolean) => {
    setLoading(true)
    setShowLocationPrompt(false)
    if (allow) {
      const locationGranted = await requestDeviceLocationPermission()
      if (!locationGranted) {
        toast({
          title: "Location was blocked",
          description: "Please allow location access to capture photo GPS coordinates while uploading photos.",
        })
      }
    }
    continueAfterLocationPrompt()
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (supabaseConfigured && !authReady) return
    setLoading(true)
    
    let success = false
    try {
      if (supabase) {
        let signInData: { user: unknown } | null = null
        let error: { message: string } | null = null
        try {
          const normalizedEmail = normalizeLoginEmail(email)
          
          // Failsafe timeout in case Supabase library deadlocks internally
          const result = await Promise.race([
            supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Login request timed out. Please check your internet connection.')), 20000)
            )
          ])
          
          signInData = result.data
          error = result.error
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          const isNetwork = /failed to fetch|network|connection|refused|timeout|time/i.test(msg)
          toast({
            title: "Login failed",
            description: isNetwork
              ? "Cannot reach the auth server. Please check your internet connection and try again."
              : msg || "Please try again.",
            variant: "destructive",
          })
          return
        }
        
        if (error) {
          toast({
            title: "Login failed",
            description: describeAuthSignInError(error as { message: string; code?: string }),
            variant: "destructive",
          })
          return
        }

        // Check profile status — block inactive users
        try {
          const authUser = (signInData as { user?: { id?: string } })?.user
          if (authUser?.id) {
            const profileRes = await Promise.race([
              supabase
                .from("profiles")
                .select("status")
                .eq("auth_user_id", authUser.id)
                .maybeSingle(),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Profile check timed out')), 10000)
              )
            ])
            const profile = profileRes.data as { status: UserStatus } | null
            if (profile?.status === "inactive") {
              await supabase.auth.signOut()
              toast({
                title: "Account deactivated",
                description: "Your account has been deactivated. Please contact your administrator.",
                variant: "destructive",
              })
              return
            }
          }
        } catch {
          // If profile check fails, allow login (profile might not exist yet)
        }

        success = true
        toast({ title: "Welcome back!", description: "Signed in successfully." })
        setShowLocationPrompt(true)
        return
      }
      
      // Demo fallback when Supabase not configured
      if (password.trim().length < 4) {
        toast({
          title: "Login failed",
          description: "Please check your credentials and try again.",
          variant: "destructive",
        })
        return
      }
      success = true
      toast({ title: "Login successful", description: "Welcome back! (demo)" })
      router.push(getLoginRedirectPath() ?? "/dashboard")
    } finally {
      if (!success) {
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Solar Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated Sun */}
        <div className="absolute top-20 right-20 w-36 h-36 animate-pulse">
          <div className="relative w-full h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-400 to-amber-500 rounded-full login-animate-spin-slow" />
            <div className="absolute inset-2 bg-gradient-to-br from-amber-300 to-orange-400 rounded-full" />
            <div className="absolute inset-4 bg-gradient-to-br from-white/30 to-transparent rounded-full" />
            {/* Sun Rays */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute top-1/2 left-1/2 w-1.5 h-16 bg-gradient-to-t from-amber-400/50 via-yellow-300/25 to-transparent origin-bottom"
                style={{
                  transform: `translate(-50%, -100%) rotate(${i * 45}deg)`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Light rays effect - subtle and professional */}
        <div className="absolute top-0 right-0 w-full h-full pointer-events-none">
          <div className="absolute top-16 right-10 w-[400px] h-[400px] bg-gradient-to-br from-amber-100/15 via-orange-50/10 to-transparent rounded-full blur-3xl" />
        </div>

        {/* Solar Panels - Professional muted blue-gray */}
        <div className="absolute bottom-32 left-20 space-y-4 login-animate-float">
          <div className="flex gap-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-20 h-24 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 rounded-lg shadow-lg border-2 border-slate-500/40 relative overflow-hidden"
                style={{
                  animationDelay: `${i * 0.2}s`,
                }}
              >
                {/* Panel frame */}
                <div className="absolute inset-0 border-[3px] border-slate-900/50 rounded-lg" />
                {/* Grid cells - subtle blue tint */}
                <div className="absolute inset-2 grid grid-cols-2 gap-[2px] p-0.5">
                  {[...Array(6)].map((_, j) => (
                    <div 
                      key={j} 
                      className="bg-slate-800/50 rounded-sm"
                    />
                  ))}
                </div>
                {/* Subtle shine */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute top-40 left-1/4 space-y-4 login-animate-float" style={{ animationDelay: "1s" }}>
          <div className="flex gap-3">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="w-16 h-20 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 rounded-lg shadow-lg border-2 border-slate-500/40 relative overflow-hidden"
              >
                <div className="absolute inset-0 border-[3px] border-slate-900/50 rounded-lg" />
                <div className="absolute inset-2 grid grid-cols-2 gap-[2px] p-0.5">
                  {[...Array(4)].map((_, j) => (
                    <div 
                      key={j} 
                      className="bg-slate-800/50 rounded-sm"
                    />
                  ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-40 right-32 space-y-4 login-animate-float" style={{ animationDelay: "0.5s" }}>
          <div className="flex gap-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="w-14 h-18 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 rounded-lg shadow-lg border-2 border-slate-500/40 relative overflow-hidden"
              >
                <div className="absolute inset-0 border-[3px] border-slate-900/50 rounded-lg" />
                <div className="absolute inset-2 grid grid-cols-2 gap-[2px] p-0.5">
                  {[...Array(4)].map((_, j) => (
                    <div 
                      key={j} 
                      className="bg-slate-800/50 rounded-sm"
                    />
                  ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Additional smaller panel for depth */}
        <div className="absolute top-60 right-48 login-animate-float" style={{ animationDelay: "1.5s" }}>
          <div className="w-10 h-12 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 rounded-lg shadow-md border border-slate-500/40 relative overflow-hidden">
            <div className="absolute inset-1 grid grid-cols-2 gap-[1px]">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="bg-slate-800/50 rounded-sm" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md bg-background/95 backdrop-blur-sm shadow-2xl rounded-2xl overflow-hidden relative z-10">
        <div className="bg-gradient-dark-green p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-background/20 rounded-full mb-4">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Skyvolts</h1>
          <p className="text-green-100 text-sm">Solar Installation Management</p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="engineer@solarepc.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border-gray-300 focus:border-green-600 focus:ring-green-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 pr-12 rounded-xl border-gray-300 focus:border-green-600 focus:ring-green-600"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || (supabaseConfigured && !authReady)}
            className="w-full bg-gradient-dark-green hover:opacity-90 text-white py-6 rounded-xl font-semibold text-base shadow-lg transition-all"
          >
            {loading && <Spinner className="mr-2" />}
            {supabaseConfigured && !authReady
              ? "Preparing sign-in…"
              : loading
                ? "Signing in…"
                : "Sign In"}
          </Button>

          <div className="text-center text-sm text-muted-foreground space-y-1">
            {supabaseConfigured ? (
              <p>
                No account? <Link href="/signup" className="text-green-600 hover:underline font-medium">Sign up</Link>
              </p>
            ) : (
              <p>Demo: any email / password (configure Supabase for real auth)</p>
            )}
          </div>
        </form>
      </Card>

      <Dialog open={showLocationPrompt} onOpenChange={setShowLocationPrompt}>
        <DialogContent
          showCloseButton={false}
          className="max-w-sm rounded-2xl px-5 py-4"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="gap-1 text-left">
            <DialogTitle className="text-base leading-5">Allow location access?</DialogTitle>
            <DialogDescription className="text-sm">
              This helps auto-capture GPS coordinates for installation photos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => handleLocationDecision(false)}>
              Don&apos;t Allow
            </Button>
            <Button type="button" onClick={() => handleLocationDecision(true)}>
              Allow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
