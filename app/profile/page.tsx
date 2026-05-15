"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, User as UserIcon, Mail, Phone, MapPin, Calendar, Shield, Activity } from "lucide-react"
import { waitForSessionReady } from "@/lib/supabase/auth"
import { getCurrentProfileFromSupabase } from "@/lib/supabase/users"
import { buildAuthHeaders } from "@/lib/data/auth-headers"
import { fetchWithTimeout } from "@/lib/data/fetch-with-timeout"
import type { User } from "@/lib/store/users"
import { toast } from "@/hooks/use-toast"
import { useFormDraft } from "@/lib/store/use-form-draft"
import { DraftBanner } from "@/components/draft-banner"

export default function ProfilePage() {
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [aadharNo, setAadharNo] = useState("")
  const [city, setCity] = useState("")
  const [district, setDistrict] = useState("")
  const [stateField, setStateField] = useState("")
  const [fullAddress, setFullAddress] = useState("")

  const draftPayload = useMemo(
    () => ({ name, phone, aadharNo, city, district, state: stateField, fullAddress }),
    [name, phone, aadharNo, city, district, stateField, fullAddress],
  )
  const [draftEnabled, setDraftEnabled] = useState(false)
  const profileDraft = useFormDraft<typeof draftPayload>("profile", draftPayload, { enabled: draftEnabled })
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)

  const handleRestoreDraft = () => {
    const d = profileDraft.restore()
    if (d) {
      setName(d.name ?? "")
      setPhone(d.phone ?? "")
      setAadharNo(d.aadharNo ?? "")
      setCity(d.city ?? "")
      setDistrict(d.district ?? "")
      setStateField(d.state ?? "")
      setFullAddress(d.fullAddress ?? "")
    }
    setDraftBannerOpen(false)
    setDraftEnabled(true)
    toast({ title: "Draft restored" })
  }

  const handleDiscardDraft = () => {
    profileDraft.clear()
    setDraftBannerOpen(false)
    setDraftEnabled(true)
  }

  useEffect(() => {
    // Profile is loaded exactly once per mount. profileDraft must not be in deps because
    // its identity changes on every debounced write, which would re-fire this fetch in a loop.
    async function loadProfile() {
      try {
        await waitForSessionReady()
        const headers = await buildAuthHeaders()
        if (headers.Authorization) {
          const res = await fetchWithTimeout(
            "/api/profile",
            { method: "GET", headers, cache: "no-store" },
            15_000,
          )
          const json = await res.json().catch(() => ({}))
          if (res.ok && json.profile) {
            const data = json.profile as User
            setProfile(data)
            setName(data.name ?? "")
            setPhone(data.phone ?? "")
            setAadharNo(data.aadharNo ?? "")
            setCity(data.city ?? "")
            setDistrict(data.district ?? "")
            setStateField(data.state ?? "")
            setFullAddress(data.fullAddress ?? "")
            return
          }
        }

        const data = await getCurrentProfileFromSupabase()
        setProfile(data)
        if (data) {
          setName(data.name ?? "")
          setPhone(data.phone ?? "")
          setAadharNo(data.aadharNo ?? "")
          setCity(data.city ?? "")
          setDistrict(data.district ?? "")
          setStateField(data.state ?? "")
          setFullAddress(data.fullAddress ?? "")
        }
      } catch (err) {
        console.error("Error loading profile:", err)
        setError("Failed to load profile data")
      } finally {
        if (profileDraft.hasDraft()) {
          setDraftBannerSavedAt(profileDraft.peekSavedAt())
          setDraftBannerOpen(true)
        } else {
          setDraftEnabled(true)
        }
        setLoading(false)
      }
    }
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getInitials = (s: string) => {
    return s
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800"
      case "manager":
        return "bg-blue-100 text-blue-800"
      case "engineer":
        return "bg-green-100 text-green-800"
      case "installer":
        return "bg-emerald-100 text-emerald-800"
      case "surveyor":
        return "bg-yellow-100 text-yellow-800"
      case "government":
        return "bg-muted text-muted-foreground800"
      default:
        return "bg-muted text-muted-foreground800"
    }
  }

  const getStatusBadgeColor = (status: string) => {
    return status === "active"
      ? "bg-green-100 text-green-800"
      : "bg-red-100 text-red-800"
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    try {
      const headers = { ...(await buildAuthHeaders(true)), "Content-Type": "application/json" }
      const res = await fetchWithTimeout(
        "/api/profile",
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            name,
            phone,
            aadharNo,
            city,
            district,
            state: stateField,
            fullAddress,
          }),
        },
        30_000,
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Could not save profile")
      }
      const updated = json.profile as User | undefined
      if (updated) {
        setProfile(updated)
        setName(updated.name ?? "")
        setPhone(updated.phone ?? "")
        setAadharNo(updated.aadharNo ?? "")
        setCity(updated.city ?? "")
        setDistrict(updated.district ?? "")
        setStateField(updated.state ?? "")
        setFullAddress(updated.fullAddress ?? "")
      }
      profileDraft.clear()
      toast({ title: "Profile updated", description: "Your changes were saved." })
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No profile data found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient-green">My Profile</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            View and update your details. Email cannot be changed here.
          </p>
        </div>

        {draftBannerOpen ? (
          <div className="mb-4">
            <DraftBanner
              savedAt={draftBannerSavedAt}
              onRestore={handleRestoreDraft}
              onDiscard={handleDiscardDraft}
              hint=""
            />
          </div>
        ) : null}

        <div className="space-y-6">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Avatar className="h-24 w-24 border-4 border-green-100">
                  <AvatarFallback className="text-2xl bg-gradient-dark-green text-white">
                    {getInitials(profile.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center sm:text-left">
                  <CardTitle className="text-2xl font-bold text-foreground">{profile.name}</CardTitle>
                  <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                    <Badge className={getRoleBadgeColor(profile.role)}>
                      <Shield className="h-3 w-3 mr-1" />
                      {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                    </Badge>
                    <Badge className={getStatusBadgeColor(profile.status || "inactive")}>
                      <Activity className="h-3 w-3 mr-1" />
                      {(profile.status || "inactive").charAt(0).toUpperCase() + (profile.status || "inactive").slice(1)}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <form onSubmit={onSave}>
            <Card className="border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-primary" />
                  Personal information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Full name</Label>
                    <Input
                      id="profile-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      minLength={2}
                      maxLength={80}
                      required
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-email">Email (read-only)</Label>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                      <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-foreground">{profile.email}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-phone">Phone</Label>
                    <Input
                      id="profile-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={20}
                      className="rounded-lg"
                      placeholder="Phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-aadhar">Aadhaar (12 digits)</Label>
                    <Input
                      id="profile-aadhar"
                      value={aadharNo}
                      onChange={(e) => setAadharNo(e.target.value.replace(/\D/g, "").slice(0, 12))}
                      maxLength={12}
                      className="rounded-lg font-mono"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-city">City</Label>
                    <Input id="profile-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className="rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-district">District</Label>
                    <Input
                      id="profile-district"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      maxLength={80}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-state">State</Label>
                    <Input id="profile-state" value={stateField} onChange={(e) => setStateField(e.target.value)} maxLength={80} className="rounded-lg" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="profile-address">Full address</Label>
                    <Input
                      id="profile-address"
                      value={fullAddress}
                      onChange={(e) => setFullAddress(e.target.value)}
                      maxLength={500}
                      className="rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button type="submit" disabled={saving} className="rounded-lg">
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Member since</p>
                    <p className="text-foreground">{formatDate(profile.createdAt)}</p>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm font-medium text-muted-foreground">User ID</p>
                  <p className="text-foreground font-mono text-sm">{profile.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
