"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "@/hooks/use-toast"
import type { Role } from "@/lib/rbac"
import { roleLabel } from "@/lib/rbac"
import {
  UpdateUserSchema,
  type UpdateUserInput,
} from "@/lib/store/users"
import {
  getUserById,
  updateUser,
  seedUsers,
} from "@/lib/data/users"

type FormValues = UpdateUserInput & { password?: string }

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(UpdateUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "engineer",
      status: "active",
      phone: "",
      aadharNo: "",
      city: "",
      state: "",
      district: "",
      fullAddress: "",
    },
    mode: "onTouched",
  })

  useEffect(() => {
    seedUsers()
    if (!id) return
    getUserById(id).then((u) => {
      if (!u) {
        setNotFound(true)
        setLoading(false)
        return
      }
      form.reset({
        name: u.name,
        email: u.email,
        password: "",
        role: u.role,
        status: u.status ?? "active",
        phone: u.phone ?? "",
        aadharNo: u.aadharNo ?? "",
        city: u.city ?? "",
        state: u.state ?? "",
        district: u.district ?? "",
        fullAddress: u.fullAddress ?? "",
      })
      setLoading(false)
    })
  }, [id, form])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (values: FormValues) => {
    if (!id) return
    setIsSubmitting(true)
    try {
      const payload: UpdateUserInput = {
        name: values.name,
        email: values.email,
        role: values.role,
        status: values.status,
        phone: values.phone ?? "",
        aadharNo: values.aadharNo ?? "",
        city: values.city ?? "",
        state: values.state ?? "",
        district: values.district ?? "",
        fullAddress: values.fullAddress ?? "",
      }
      if (values.password && values.password.trim() !== "") {
        payload.password = values.password
      }
      const updated = await updateUser(id, payload)
      toast({
        title: "User updated",
        description: `${updated.name} (${roleLabel(updated.role)}) was updated.`,
      })
      router.push(`/users/${id}`)
    } catch (e) {
      toast({
        title: "Could not update user",
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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-muted-foreground">User not found.</p>
        <Link href="/users">
          <Button variant="outline" className="mt-4">Back to Users</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <Link href={id ? `/users/${id}` : "/users"}>
          <Button variant="ghost" className="text-foreground hover:bg-accent">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to User
          </Button>
        </Link>
      </div>

      <Card className="max-w-2xl border-border bg-card shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Edit User</CardTitle>
          <p className="text-sm text-muted-foreground">Update full name, email, password (optional), role, address and status.</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="user@solarepc.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password (leave blank to keep current)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Min 6 characters" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as Role)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="engineer">Engineer</SelectItem>
                        <SelectItem value="surveyor">Surveyor</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as 'active' | 'inactive')}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g. 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aadharNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aadhaar number</FormLabel>
                    <FormControl>
                      <Input placeholder="12 digits" maxLength={12} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="State" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <FormControl>
                      <Input placeholder="District" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Street, area, landmark..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit — same style as installation form */}
              <div className="rounded-xl border-2 border-green-200 bg-muted/50/80 p-5">
                <p className="mb-4 text-sm font-medium text-green-800">Ready? Save your changes</p>
                <div className="flex flex-wrap gap-4">
                  <Button type="button" variant="outline" size="lg" onClick={() => router.push(`/users/${id}`)} className="border-solar text-foreground">
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
