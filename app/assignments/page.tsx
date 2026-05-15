"use client"

import Link from "next/link"
import { ArrowRight, ClipboardList, FolderKanban, ShieldCheck, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const sections = [
  {
    title: "Survey → installer",
    description:
      "On one screen: search surveys, then assign or change the installer with a searchable picker (no need to open each survey unless you want detail).",
    icon: ClipboardList,
    primary: { label: "Assign installers", href: "/assignments/survey-installers" },
    secondary: { label: "All surveys", href: "/surveys" },
  },
  {
    title: "Inspection → inspector",
    description:
      "Assign a government-role inspector to an inspection from the inspection detail page.",
    icon: ShieldCheck,
    primary: { label: "Inspections", href: "/inspections" },
    secondary: null,
  },
  {
    title: "Project team",
    description:
      "Assign a manager or surveyor when creating or editing a project (project form assignments).",
    icon: FolderKanban,
    primary: { label: "Projects", href: "/projects" },
    secondary: null,
  },
] as const

export default function AssignmentsHubPage() {
  return (
    <div className="p-6 sm:p-8">
      <div className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground">Assignments</h1>
        <p className="mt-2 text-muted-foreground">
          Staff assignment is split by workflow. Use the sections below to jump to the right place. Installers,
          inspectors, and project roles are managed in different screens so permissions stay clear.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.title} className="border-border bg-card shadow-sm rounded-xl flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg leading-snug">{section.title}</CardTitle>
                    <CardDescription className="mt-2 text-sm leading-relaxed">{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-2 pt-0">
                <Button asChild className="w-full justify-between bg-gradient-primary-button text-white hover:opacity-90 rounded-xl">
                  <Link href={section.primary.href}>
                    {section.primary.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                {section.secondary ? (
                  <Button variant="outline" asChild className="w-full rounded-xl border-border">
                    <Link href={section.secondary.href}>{section.secondary.label}</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="mt-8 max-w-3xl border-border bg-muted/30 shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">User accounts</CardTitle>
          </div>
          <CardDescription>
            Installers and other roles are created under Users. If a dropdown is empty, add people there first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" asChild className="rounded-xl">
            <Link href="/users">
              Open Users
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
