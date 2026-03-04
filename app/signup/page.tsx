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

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = useSupabaseAuth()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) {
      toast({ title: "Sign up not configured", description: "Set Supabase env vars for auth.", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() || undefined } },
      })
      if (error) {
        toast({ title: "Sign up failed", description: error.message, variant: "destructive" })
        setLoading(false)
        return
      }
      if (data.user && !data.session) {
        toast({
          title: "Check your email",
          description: "Confirm your email address to sign in.",
        })
        router.push("/")
        return
      }
      toast({ title: "Account created", description: "Welcome!" })
      router.push("/dashboard")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#f3f4f6]">
        <Card className="p-8 max-w-md text-center">
          <p className="text-muted-foreground mb-4">Sign up is available when Supabase is configured.</p>
          <Link href="/">
            <Button variant="outline">Back to sign in</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-background/95 shadow-2xl rounded-2xl overflow-hidden">
        <div className="bg-gradient-dark-green p-6 text-center">
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-green-100 text-sm">SolarEPC</p>
        </div>
        <form onSubmit={handleSignUp} className="p-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">At least 6 characters</p>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-dark-green hover:opacity-90 text-white py-6 rounded-xl font-semibold"
          >
            {loading ? "Creating account…" : "Sign up"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link href="/" className="text-green-600 hover:underline font-medium">Sign in</Link>
          </p>
        </form>
      </Card>
    </div>
  )
}
