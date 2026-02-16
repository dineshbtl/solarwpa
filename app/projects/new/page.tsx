"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "@/hooks/use-toast"
import { CreateProjectSchema, type CreateProjectInput } from "@/lib/store/projects"
import { createProject } from "@/lib/data/projects"
import { useUsers } from "@/lib/data/hooks"
import { siteLocationOptions } from "@/lib/data/site-location-options"
import { LocationAutocomplete } from "@/components/location-autocomplete"
import { seedUsers } from "@/lib/data/users"
import { useEffect } from "react"

export default function NewProjectPage() {
  const router = useRouter()
  const { data: users = [], refetch: refetchUsers } = useUsers()

  useEffect(() => {
    seedUsers().then(() => refetchUsers())
  }, [refetchUsers])

  const managers = useMemo(() => users.filter((u) => u.role === "manager" || u.role === "admin"), [users])

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(CreateProjectSchema),
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

  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (values: CreateProjectInput) => {
    setIsSubmitting(true)
    try {
      const p = await createProject(values)
      toast({
        title: "Project created",
        description: `${p.projectName} (${p.id})`,
      })
      router.push("/projects")
    } catch (e) {
      toast({
        title: "Could not create project",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderUserOptions = (list: typeof users) =>
    list.map((u) => (
      <SelectItem key={u.id} value={u.id}>
        {u.name} ({u.id})
      </SelectItem>
    ))

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <Link href="/projects">
          <Button variant="ghost" className="text-solar-dark hover:bg-solar-beige">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>
      </div>

      <Card className="max-w-3xl border-border bg-white shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Create Project</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create a project and assign a manager.
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6">
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
              </div>

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
                      <Textarea rows={3} placeholder="Full installation address" {...field} />
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
              </div>

              {/* Submit — same style as installation form */}
              <div className="rounded-xl border-2 border-green-200 bg-green-50/80 p-5">
                <p className="mb-4 text-sm font-medium text-green-800">Ready? Create your project</p>
                <div className="flex flex-wrap gap-4">
                  <Button type="button" variant="outline" size="lg" onClick={() => router.push("/projects")} className="border-solar text-solar-dark">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="min-w-[220px] bg-green-600 py-6 text-base font-semibold text-white shadow-lg hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSubmitting ? "Creating..." : "Create Project"}
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

