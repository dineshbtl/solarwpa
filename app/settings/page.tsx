"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Loader2, Settings, Palette, Bell, Shield, Database, Globe, Clock, Info } from "lucide-react"
import { getCurrentProfileFromSupabase } from "@/lib/supabase/users"
import { useTheme } from "next-themes"
import type { User } from "@/lib/store/users"

// Application settings configuration
const appSettings = {
  version: "1.0.0",
  environment: process.env.NODE_ENV || "development",
  features: {
    darkMode: false,
    notifications: true,
    analytics: true,
  },
  limits: {
    maxProjects: 100,
    maxSurveys: 1000,
    maxInstallations: 500,
    maxStorage: "5GB",
  },
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { theme, setTheme } = useTheme()
  const [darkModeEnabled, setDarkModeEnabled] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getCurrentProfileFromSupabase()
        setProfile(data)
      } catch (err) {
        console.error("Error loading profile:", err)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [])

  useEffect(() => {
    setDarkModeEnabled(theme === "dark")
  }, [theme])

  const handleDarkModeToggle = (enabled: boolean) => {
    setDarkModeEnabled(enabled)
    setTheme(enabled ? "dark" : "light")
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient-green">Settings</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            View application configuration and preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* User Settings Card */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : profile ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm font-medium text-muted-foreground">Your Role</p>
                    <p className="text-foreground capitalize mt-1">{profile.role}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm font-medium text-muted-foreground">Account Status</p>
                    <div className="mt-1">
                      <Badge className={profile.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {profile.status || "inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Not logged in</p>
              )}
            </CardContent>
          </Card>

          {/* Application Info Card */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                Application Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Version</p>
                    <p className="text-foreground">{appSettings.version}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Environment</p>
                    <p className="text-foreground capitalize">{appSettings.environment}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Server Time</p>
                    <p className="text-foreground">
                      {new Date().toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZoneName: "short",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Settings Card */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Feature Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Palette className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-foreground font-medium">Dark Mode</p>
                      <p className="text-sm text-muted-foreground">Use dark theme across the application</p>
                    </div>
                  </div>
                  <Switch checked={darkModeEnabled} onCheckedChange={handleDarkModeToggle} />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-foreground font-medium">Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive alerts and updates</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    {appSettings.features.notifications ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-foreground font-medium">Analytics</p>
                      <p className="text-sm text-muted-foreground">Help improve the application</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    {appSettings.features.analytics ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Limits Card */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                System Limits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <p className="text-3xl font-bold text-primary">{appSettings.limits.maxProjects}</p>
                  <p className="text-sm text-muted-foreground mt-1">Max Projects</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <p className="text-3xl font-bold text-primary">{appSettings.limits.maxSurveys}</p>
                  <p className="text-sm text-muted-foreground mt-1">Max Surveys</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <p className="text-3xl font-bold text-primary">{appSettings.limits.maxInstallations}</p>
                  <p className="text-sm text-muted-foreground mt-1">Max Installations</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <p className="text-3xl font-bold text-primary">{appSettings.limits.maxStorage}</p>
                  <p className="text-sm text-muted-foreground mt-1">Storage Limit</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Read-only Notice */}
          <Card className="border-border bg-muted/30 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Read-only Settings</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This page displays application configuration for reference. Settings cannot be modified directly.
                    Contact your administrator for any configuration changes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
