  "use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClipboardCheck, MapPin, Wrench, CheckCircle, TrendingUp, Loader2 } from "lucide-react"
import Link from "next/link"
import { useProjects, useSurveys, useInstallations, useInspections } from "@/lib/data/hooks"
import type { Survey } from "@/lib/data/surveys"
import type { Installation } from "@/lib/data/installations"
import type { Inspection } from "@/lib/data/inspections"

function surveyAddress(s: Survey): string {
  const loc = s.siteLocation
  if (loc?.address) return loc.address
  const parts = [loc?.section, loc?.district, loc?.city].filter(Boolean) as string[]
  return parts.length ? parts.join(", ") : s.serviceNo ?? "—"
}

export default function DashboardPage() {
  const { data: projects = [], loading: projectsLoading } = useProjects()
  const { data: surveys = [], loading: surveysLoading } = useSurveys()
  const { data: installations = [], loading: installationsLoading } = useInstallations()
  const { data: inspections = [], loading: inspectionsLoading } = useInspections()

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    const completedThisMonth = installations.filter((i) => {
      if (i.status !== "completed" || !i.completedAt) return false
      const d = new Date(i.completedAt)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    }).length
    return {
      totalProjects: projects.length,
      pendingSurveys: surveys.filter((s) => s.status === "pending").length,
      activeInstallations: installations.filter(
        (i) => i.status === "in_progress" || i.status === "pending" || i.status === "inspection_pending"
      ).length,
      completedThisMonth,
    }
  }, [projects.length, surveys, installations])

  const recentSurveys = useMemo(() => surveys.slice(0, 3), [surveys])
  const displayInstallations = useMemo(() => installations.slice(0, 5), [installations])
  const pendingInspections = useMemo(
    () => inspections.filter((i) => i.status === "pending" || i.status === "reopened").slice(0, 5),
    [inspections]
  )

  const loading = projectsLoading || surveysLoading || installationsLoading || inspectionsLoading

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient-green">Welcome back</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Track your solar installations and manage projects efficiently.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="mb-6 sm:mb-8 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-gradient-dark-green p-6 shadow-lg transition-transform hover:scale-105">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/80">Total Projects</p>
                    <h3 className="mt-3 text-4xl font-bold text-white">{stats.totalProjects}</h3>
                    <p className="mt-2 text-xs text-green-100">All projects</p>
                  </div>
                  <div className="rounded-lg bg-background/20 p-3">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-gradient-dark-green p-6 shadow-lg transition-transform hover:scale-105">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/80">Pending Surveys</p>
                    <h3 className="mt-3 text-4xl font-bold text-white">{stats.pendingSurveys}</h3>
                    <p className="mt-2 text-xs text-green-100">Awaiting approval</p>
                  </div>
                  <div className="rounded-lg bg-background/20 p-3">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-gradient-dark-green p-6 shadow-lg transition-transform hover:scale-105">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/80">Active Installations</p>
                    <h3 className="mt-3 text-4xl font-bold text-white">{stats.activeInstallations}</h3>
                    <p className="mt-2 text-xs text-green-100">In progress</p>
                  </div>
                  <div className="rounded-lg bg-background/20 p-3">
                    <Wrench className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-gradient-dark-green p-6 shadow-lg transition-transform hover:scale-105">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/80">Completed</p>
                    <h3 className="mt-3 text-4xl font-bold text-white">{stats.completedThisMonth}</h3>
                    <p className="mt-2 text-xs text-green-100">This month</p>
                  </div>
                  <div className="rounded-lg bg-background/20 p-3">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              <Card className="border-border bg-card shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-foreground">Recent Surveys</CardTitle>
                    <Link href="/surveys">
                      <Button variant="ghost" size="sm" className="text-primary hover:bg-muted/50">
                        View All
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentSurveys.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No surveys yet.</p>
                    ) : (
                      recentSurveys.map((survey) => (
                        <Link key={survey.id} href={`/surveys/${survey.id}`}>
                          <div className="flex items-start gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50">
                            <div className="rounded-lg bg-gradient-green-light p-2">
                              <ClipboardCheck className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground">{survey.beneficiaryName}</h3>
                              <p className="text-sm text-muted-foreground">
                                {surveyAddress(survey).split(",")[0]}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                    survey.status === "approved"
                                      ? "bg-green-100 text-green-800"
                                      : survey.status === "rejected"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-yellow-100 text-yellow-800"
                                  }`}
                                >
                                  {survey.status}
                                </span>
                                {survey.serviceNo && (
                                  <span className="text-xs text-muted-foreground">{survey.serviceNo}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-foreground">Active Installations</CardTitle>
                    <Link href="/installations">
                      <Button variant="ghost" size="sm" className="text-primary hover:bg-muted/50">
                        View All
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {displayInstallations.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No installations yet.</p>
                    ) : (
                      displayInstallations.map((installation: Installation) => (
                        <Link key={installation.id} href={`/installations/${installation.id}`}>
                          <div className="flex items-start gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50">
                            <div className="rounded-lg bg-gradient-green-light p-2">
                              <Wrench className="h-5 w-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground">{installation.customerName}</h3>
                              <p className="text-sm text-muted-foreground">
                                {installation.address.split(",")[0]}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                    installation.status === "completed"
                                      ? "bg-green-100 text-green-800"
                                      : installation.status === "in_progress"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-yellow-100 text-yellow-800"
                                  }`}
                                >
                                  {installation.status.replace("_", " ")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {installation.materials?.length ?? 0} materials
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6 border-border bg-card shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-foreground">Pending Inspections</CardTitle>
                  <Link href="/inspections">
                    <Button variant="ghost" size="sm" className="text-primary hover:bg-muted/50">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingInspections.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No pending inspections.</p>
                  ) : (
                    pendingInspections.map((inspection: Inspection) => (
                      <Link key={inspection.id} href={`/inspections/${inspection.id}`}>
                        <div className="flex items-start gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50">
                          <div className="rounded-lg bg-gradient-green-light p-2">
                            <CheckCircle className="h-5 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{inspection.customerName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {inspection.address.split(",")[0]}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                  inspection.status === "approved"
                                    ? "bg-green-100 text-green-800"
                                    : inspection.status === "rejected"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {inspection.status}
                              </span>
                              {inspection.managerApproval?.approved && (
                                <span className="text-xs text-green-600">Manager Approved</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
