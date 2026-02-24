"use client"

import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Save, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "@/hooks/use-toast"
import { UpdateProjectSchema, type UpdateProjectInput } from "@/lib/store/projects"
import { getProjectById, updateProject } from "@/lib/data/projects"
import { useProject, useUsers } from "@/lib/data/hooks"
import { seedUsers } from "@/lib/data/users"
import { siteLocationOptions } from "@/lib/data/site-location-options"
import { LocationAutocomplete } from "@/components/location-autocomplete"

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ?? null
  const { data: project, loading: projectLoading } = useProject(id)
  const { data: users = [], refetch: refetchUsers } = useUsers()

  useEffect(() => {
    seedUsers().then(() => refetchUsers())
  }, [refetchUsers])

  const managers = useMemo(() => users.filter((u) => u.role === "manager" || u.role === "admin"), [users])
  const surveyors = useMemo(() => users.filter((u) => u.role === "surveyor"), [users])

  const form = useForm<UpdateProjectInput>({
    resolver: zodResolver(UpdateProjectSchema),
    defaultValues: {
      projectName: "",
      description: "",
      state: "",
      city: "",
      district: "",
      pincode: "",
      address: "",
      additionalInfo: "",
      assignments: {},
    },
    mode: "onTouched",
  })

  useEffect(() => {
    if (!project) return
    form.reset({
      projectName: project.projectName ?? "",
      description: project.description ?? "",
      state: project.state ?? "",
      city: project.city ?? "",
      district: project.district ?? "",
      pincode: project.pincode ?? "",
      address: project.address ?? "",
      additionalInfo: project.additionalInfo ?? "",
      assignments: project.assignments ?? {},
    })
  }, [project, form])

  const loading = projectLoading && !!id
  const notFound = !!id && !projectLoading && !project

  const renderUserOptions = (list: typeof users) =>
    list.map((u) => (
      <SelectItem key={u.id} value={u.id}>
        {u.name} ({u.id})
      </SelectItem>
    ))

  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (values: UpdateProjectInput) => {
    if (!id) return
    setIsSubmitting(true)
    try {
      await updateProject(id, values)
      toast({ title: "Project updated" })
      router.push("/projects")
    } catch (e) {
      toast({
        title: "Could not update project",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <div className="mt-4">
          <Link href="/projects">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <Link href="/projects">
          <Button variant="ghost" className="text-foreground hover:bg-accent">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>
      </div>

      <Card className="max-w-3xl border-border bg-card shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Edit Project</CardTitle>
          <p className="text-sm text-muted-foreground">Update project details and assignments.</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Rajesh Kumar Rooftop Solar" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Short description of the project" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <LocationAutocomplete
                          options={siteLocationOptions.states}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Search state..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <LocationAutocomplete
                          options={siteLocationOptions.cities}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Search city..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District</FormLabel>
                      <FormControl>
                        <LocationAutocomplete
                          options={siteLocationOptions.districts}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Search district..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <LocationAutocomplete
                          options={siteLocationOptions.pinCodes}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Search pincode..."
                          inputMode="numeric"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Full installation address (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="additionalInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Info</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Notes, landmarks, customer requirements, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name={"assignments.managerId" as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Manager</FormLabel>
                      <Select
                        value={field.value ?? "__none__"}
                        onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {renderUserOptions(managers)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={"assignments.surveyorId" as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Surveyor</FormLabel>
                      <Select
                        value={field.value ?? "__none__"}
                        onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {renderUserOptions(surveyors)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit — same style as installation form */}
              <div className="rounded-xl border-2 border-green-200 bg-muted/50/80 p-5">
                <p className="mb-4 text-sm font-medium text-green-800">Ready? Save your changes</p>
                <div className="flex flex-wrap gap-4">
                  <Button type="button" variant="outline" size="lg" onClick={() => router.push("/projects")} className="border-solar text-foreground">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="min-w-[220px] bg-green-600 py-6 text-base font-semibold text-white shadow-lg hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

