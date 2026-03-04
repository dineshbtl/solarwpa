"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, User as UserIcon, Mail, Phone, MapPin, Calendar, Shield, Activity } from "lucide-react"
import { getCurrentProfileFromSupabase } from "@/lib/supabase/users"
import type { User } from "@/lib/store/users"

export default function ProfilePage() {
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getCurrentProfileFromSupabase()
        setProfile(data)
      } catch (err) {
        console.error("Error loading profile:", err)
        setError("Failed to load profile data")
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [])

  const getInitials = (name: string) => {
    return name
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
            View your account information and details
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Header Card */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Avatar className="h-24 w-24 border-4 border-green-100">
                  <AvatarFallback className="text-2xl bg-gradient-dark-green text-white">
                    {getInitials(profile.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center sm:text-left">
                  <CardTitle className="text-2xl font-bold text-foreground">
                    {profile.name}
                  </CardTitle>
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

          {/* Personal Information Card */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email Address</p>
                    <p className="text-foreground">{profile.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                    <p className="text-foreground">{profile.phone || "—"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Location</p>
                    <p className="text-foreground">
                      {[profile.city, profile.district, profile.state]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Member Since</p>
                    <p className="text-foreground">{formatDate(profile.createdAt)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Details Card */}
          {(profile.aadharNo || profile.fullAddress) && (
            <Card className="border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Additional Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {profile.aadharNo && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Aadhar Number</p>
                        <p className="text-foreground">
                          {profile.aadharNo.replace(/(\d{4})/g, "$1 ").trim()}
                        </p>
                      </div>
                    </div>
                  )}

                  {profile.fullAddress && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 sm:col-span-2">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Full Address</p>
                        <p className="text-foreground">{profile.fullAddress}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Info Card */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm font-medium text-muted-foreground">User ID</p>
                  <p className="text-foreground font-mono text-sm">{profile.id}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm font-medium text-muted-foreground">Account Status</p>
                  <p className="text-foreground capitalize">{profile.status}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
