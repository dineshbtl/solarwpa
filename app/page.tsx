"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"

function useSupabaseAuth() {
  if (typeof window === "undefined") return null
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const { getSupabaseBrowserClient } = require("@/lib/supabase/client")
      return getSupabaseBrowserClient()
    }
  } catch {
    // env not set or client not available
  }
  return null
}

/** Same on server and client – use for UI that must not hydration-mismatch. */
function isSupabaseConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = useSupabaseAuth()
  const supabaseConfigured = isSupabaseConfigured()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (supabase) {
        let data: { user: unknown } | null = null
        let error: { message: string } | null = null
        try {
          const result = await supabase.auth.signInWithPassword({ email: email.trim(), password })
          data = result.data
          error = result.error
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          const isNetwork = /failed to fetch|network|connection|refused|timeout/i.test(msg)
          toast({
            title: "Login failed",
            description: isNetwork
              ? "Cannot reach the auth server. Open the app using the same address as Supabase (e.g. http://172.30.0.191:3000 for LAN or http://183.82.117.36:3000 for internet) and ensure Supabase is running."
              : msg || "Please try again.",
            variant: "destructive",
          })
          setLoading(false)
          return
        }
        if (error) {
          toast({
            title: "Login failed",
            description: error.message,
            variant: "destructive",
          })
          setLoading(false)
          return
        }

        // Check profile status — block inactive users
        try {
          const authUser = (data as { user?: { id?: string } })?.user
          if (authUser?.id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("status")
              .eq("auth_user_id", authUser.id)
              .maybeSingle()
            if (profile?.status === "inactive") {
              await supabase.auth.signOut()
              toast({
                title: "Account deactivated",
                description: "Your account has been deactivated. Please contact your administrator.",
                variant: "destructive",
              })
              setLoading(false)
              return
            }
          }
        } catch {
          // If profile check fails, allow login (profile might not exist yet)
        }

        toast({ title: "Welcome back!", description: "Signed in successfully." })
        router.push("/dashboard")
        router.refresh()
        return
      }
      // Demo fallback when Supabase not configured
      if (password.trim().length < 4) {
        toast({
          title: "Login failed",
          description: "Please check your credentials and try again.",
          variant: "destructive",
        })
        setLoading(false)
        return
      }
      toast({ title: "Login successful", description: "Welcome back! (demo)" })
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Solar Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated Sun */}
        <div className="absolute top-20 right-20 w-36 h-36 animate-pulse">
          <div className="relative w-full h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-400 to-amber-500 rounded-full animate-spin-slow" />
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
        <div className="absolute bottom-32 left-20 space-y-4 animate-float">
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

        <div className="absolute top-40 left-1/4 space-y-4 animate-float" style={{ animationDelay: "1s" }}>
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

        <div className="absolute bottom-40 right-32 space-y-4 animate-float" style={{ animationDelay: "0.5s" }}>
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
        <div className="absolute top-60 right-48 animate-float" style={{ animationDelay: "1.5s" }}>
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
          <h1 className="text-3xl font-bold text-white mb-2">SolarEPC</h1>
          <p className="text-green-100 text-sm">Installation Management System</p>
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
            disabled={loading}
            className="w-full bg-gradient-dark-green hover:opacity-90 text-white py-6 rounded-xl font-semibold text-base shadow-lg transition-all"
          >
            {loading ? "Signing in…" : "Sign In"}
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

      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
      `}</style>
    </div>
  )
}
