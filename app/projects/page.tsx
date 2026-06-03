"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Folder, CheckCircle, Zap, ClipboardList, TrendingUp, Plus, UserCog, Pencil } from "lucide-react"
import Link from "next/link"
import { updateProjectAssignments } from "@/lib/data/projects"
import { useProjects, useUsers, useSurveys, useInstallations, useInspections } from "@/lib/data/hooks"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"
import { ProjectsPageSkeleton } from "@/components/projects-loading-skeletons"

export default function ProjectsPage() {
  const { data: storedProjects, loading: projectsLoading, error: projectsError, refetch: refetchProjects } = useProjects()
  const { data: users = [] } = useUsers()
  const { data: realSurveys = [] } = useSurveys()
  const { data: installations = [] } = useInstallations()
  const { data: inspections = [] } = useInspections()
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignProjectId, setAssignProjectId] = useState<string | null>(null)
  const [assignManagerId, setAssignManagerId] = useState<string>("__none__")
  const [assignSurveyorId, setAssignSurveyorId] = useState<string>("__none__")
  const [assignSaving, setAssignSaving] = useState(false)

  // Projects from database only: enrich each stored project with survey/installation/inspection from DB
  const projects = useMemo(() => {
    return storedProjects
      .filter((p) => p.id === ACTIVE_PROJECT_ID)
      .map((p) => {
      const projectSurveys = realSurveys.filter((s) => s.projectId === p.id)
      const surveyCount = projectSurveys.length
      const firstSurvey = projectSurveys[0] ?? null
      const projectInstallations = installations.filter((i) => i.projectId === p.id)
      const firstInstallation = projectInstallations[0] ?? null
      const projectInspections = inspections.filter((i) => i.projectId === p.id)
      const firstInspection = projectInspections[0] ?? null

      return {
        id: p.id,
        projectName: p.projectName,
        description: p.description,
        state: p.state,
        city: p.city,
        district: p.district,
        pincode: p.pincode,
        address: p.address,
        additionalInfo: p.additionalInfo,
        assignments: p.assignments ?? {},
        survey: firstSurvey,
        surveyCount,
        installation: firstInstallation,
        inspection: firstInspection,
        _stored: true,
      }
      })
  }, [storedProjects, realSurveys, installations, inspections])

  const getUserById = (uid: string) => users.find((u) => u.id === uid)
  const managerOptions = useMemo(() => users.filter((u) => u.role === "manager" || u.role === "admin"), [users])
  const surveyorOptions = useMemo(() => users.filter((u) => u.role === "surveyor"), [users])

  const getProjectStatus = (project: any) => {
    if (project.inspection?.status === "approved") return "completed"
    if (project.inspection) return "inspection"
    if (project.installation) return "installation"
    if (project.survey) return "survey"
    return "pending"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-400"
      case "inspection":
        return "bg-blue-500/20 text-blue-400"
      case "installation":
        return "bg-purple-500/20 text-purple-400"
      case "survey":
        return "bg-yellow-500/20 text-yellow-400"
      default:
        return "bg-muted text-muted-foreground800"
    }
  }

  const openAssignDialog = (projectId: string) => {
    const p = storedProjects.find((x) => x.id === projectId)
    setAssignProjectId(projectId)
    setAssignManagerId(p?.assignments?.managerId ?? "__none__")
    setAssignSurveyorId(p?.assignments?.surveyorId ?? "__none__")
    setAssignOpen(true)
  }

  const saveAssignments = async () => {
    if (!assignProjectId) return
    setAssignSaving(true)
    try {
      const managerId = assignManagerId === "__none__" ? undefined : assignManagerId
      const surveyorId = assignSurveyorId === "__none__" ? undefined : assignSurveyorId
      await updateProjectAssignments(assignProjectId, { managerId, surveyorId })
      toast({ title: "Assignments updated" })
      setAssignOpen(false)
      refetchProjects()
    } catch (e) {
      toast({
        title: "Could not update assignments",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setAssignSaving(false)
    }
  }

  if (projectsLoading && storedProjects.length === 0) {
    return <ProjectsPageSkeleton />
  }

  if (projectsError) {
    return (
      <div className="p-8">
        <p className="text-destructive">Could not load projects. Please refresh.</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground">All Projects</h1>
          <p className="mt-2 text-muted-foreground">Complete overview of all solar installation projects</p>
        </div>
        <Link href="/projects/new">
          <Button className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Create Project
          </Button>
        </Link>
      </div>

      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden rounded-xl border border-border shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <div className="bg-gradient-dark-green p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="rounded-xl bg-background/20 backdrop-blur-sm p-3">
                <Folder className="h-8 w-8 text-white" />
              </div>
              <div className="flex items-center gap-1 text-green-100 text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>+12%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-green-100/80">Total Projects</p>
              <p className="mt-2 text-4xl font-bold text-white">{projects.length}</p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-xl border border-border shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <div className="bg-gradient-to-br from-emerald-600 to-green-700 p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="rounded-xl bg-background/20 backdrop-blur-sm p-3">
                <ClipboardList className="h-8 w-8 text-white" />
              </div>
              <div className="flex items-center gap-1 text-emerald-100 text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>+8%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-100/80">In Survey</p>
              <p className="mt-2 text-4xl font-bold text-white">
                {projects.filter((p) => getProjectStatus(p) === "survey").length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-xl border border-border shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <div className="bg-gradient-to-br from-teal-600 to-emerald-700 p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="rounded-xl bg-background/20 backdrop-blur-sm p-3">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <div className="flex items-center gap-1 text-teal-100 text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>+15%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-teal-100/80">In Installation</p>
              <p className="mt-2 text-4xl font-bold text-white">
                {projects.filter((p) => getProjectStatus(p) === "installation").length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-xl border border-border shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <div className="bg-gradient-to-br from-green-700 to-emerald-800 p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="rounded-xl bg-background/20 backdrop-blur-sm p-3">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <div className="flex items-center gap-1 text-green-100 text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>+22%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-green-100/80">Completed</p>
              <p className="mt-2 text-4xl font-bold text-white">
                {projects.filter((p) => getProjectStatus(p) === "completed").length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {projects.map((project) => {
          const status = getProjectStatus(project)
          const manager = project.assignments?.managerId ? getUserById(project.assignments.managerId) : undefined
          const projectTitle = project.projectName ?? project.id
          const surveyor = project.assignments?.surveyorId ? getUserById(project.assignments.surveyorId) : undefined

          return (
            <Card
              key={project.id}
              className="overflow-hidden rounded-xl border border-border shadow-sm transition-all hover:shadow-md"
            >
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-gradient-light-green p-3">
                      <Folder className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-xl text-foreground">{projectTitle}</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground font-mono">ID: {project.id}</p>
                      {(project.district || project.city || project.state) && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground/80">Location: </span>
                          {[project.district, project.city, project.state].filter(Boolean).join(", ")}
                          {project.pincode && ` • ${project.pincode}`}
                        </p>
                      )}
                      {(manager || surveyor) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {manager && (
                            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              Manager: {manager.name}
                            </Badge>
                          )}
                          {surveyor && (
                            <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                              Surveyor: {surveyor.name}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(status)}`}
                    >
                      {status}
                    </span>
                    <Link href={`/projects/${project.id}/edit`}>
                      <Button type="button" variant="outline" size="sm" className="rounded-lg">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => openAssignDialog(project.id)}
                    >
                      <UserCog className="mr-2 h-4 w-4" />
                      Assign
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-3 mb-4">
                  {(project.survey || (project.surveyCount ?? 0) > 0) && (
                    <Link href={project.survey ? `/survey-details?id=${project.survey.id}` : `/surveys?project=${project.id}`}>
                      <Card className="cursor-pointer overflow-hidden rounded-lg border border-border shadow-sm transition-all hover:shadow-md hover:bg-muted">
                        <CardContent className="p-4">
                          <p className="text-xs font-medium text-muted-foreground">Survey{((project.surveyCount ?? 0) > 1) ? `s` : ""}</p>
                          <p className="mt-2 font-semibold text-foreground">
                            {(project.surveyCount ?? 0) > 1 ? `${project.surveyCount} surveys` : project.survey?.id ?? project.surveyCount}
                          </p>
                          {project.survey && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Status:{" "}
                              <span
                                className={
                                  project.survey.status === "approved"
                                    ? "text-green-600 font-medium"
                                    : "text-yellow-600 font-medium"
                                }
                              >
                                {project.survey.status}
                              </span>
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  )}

                  {project.installation && (
                    <Link href={`/installation-details?id=${project.installation.id}`}>
                      <Card className="cursor-pointer overflow-hidden rounded-lg border border-border shadow-sm transition-all hover:shadow-md hover:bg-muted">
                        <CardContent className="p-4">
                          <p className="text-xs font-medium text-muted-foreground">Installation</p>
                          <p className="mt-2 font-semibold text-foreground">{project.installation.id}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Status:{" "}
                            <span
                              className={
                                project.installation.status === "completed"
                                  ? "text-green-600 font-medium"
                                  : "text-blue-600 font-medium"
                              }
                            >
                              {project.installation.status.replace("_", " ")}
                            </span>
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  )}

                  {project.inspection && (
                    <Link href={`/inspection-details?id=${project.inspection.id}`}>
                      <Card className="cursor-pointer overflow-hidden rounded-lg border border-border shadow-sm transition-all hover:shadow-md hover:bg-muted">
                        <CardContent className="p-4">
                          <p className="text-xs font-medium text-muted-foreground">Inspection</p>
                          <p className="mt-2 font-semibold text-foreground">{project.inspection.id}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Status:{" "}
                            <span
                              className={
                                project.inspection.status === "approved"
                                  ? "text-green-600 font-medium"
                                  : "text-yellow-600 font-medium"
                              }
                            >
                              {project.inspection.status}
                            </span>
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  )}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
                    <span>Survey</span>
                    <span>Installation</span>
                    <span>Inspection</span>
                    <span>Complete</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-gradient-dark-green transition-all duration-300"
                      style={{
                        width:
                          status === "completed"
                            ? "100%"
                            : status === "inspection"
                              ? "75%"
                              : status === "installation"
                                ? "50%"
                                : "25%",
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign users</DialogTitle>
            <DialogDescription>Assign a manager and/or a surveyor to this project.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-sm font-medium">Manager</p>
              <Select value={assignManagerId} onValueChange={setAssignManagerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {managerOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-medium">Surveyor</p>
              <Select value={assignSurveyorId} onValueChange={setAssignSurveyorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {surveyorOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="bg-gradient-primary-button text-white hover:opacity-90" onClick={saveAssignments} disabled={assignSaving}>
              {assignSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
