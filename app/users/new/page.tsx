"use client"

import type React from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Save, Loader2, Eye, EyeOff } from "lucide-react"
import { useForm } from "react-hook-form"
import { useEffect, useMemo, useRef, useState } from "react"
import { useFormDraft } from "@/lib/store/use-form-draft"
import { DraftBanner } from "@/components/draft-banner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "@/hooks/use-toast"
import type { Role } from "@/lib/rbac"
import { roleLabel, ROLE_LABEL, ROLES_LIST } from "@/lib/rbac"
import { CreateUserSchema, type CreateUserInput } from "@/lib/store/users"
import { z } from "zod"
import { createUserAction } from "@/app/users/actions"
import { INDIAN_STATES, OTHER, getDistrictsForState } from "@/lib/data/india-locations"
import { getCityOptionsForState, getAllCityOptions } from "@/lib/data/indian-cities"

type CreateUserFormValues = CreateUserInput & { stateOther?: string; districtOther?: string; cityOther?: string }

export default function NewUserPage() {
  const router = useRouter()

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(
      CreateUserSchema.extend({
        stateOther: z.string().optional(),
        districtOther: z.string().optional(),
        cityOther: z.string().optional(),
      })
    ),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "",
      status: "active",
      phone: "",
      aadharNo: "",
      city: "",
      state: "",
      district: "",
      fullAddress: "",
      stateOther: "",
      districtOther: "",
      cityOther: "",
    },
    mode: "onTouched",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Persist non-sensitive fields only — password is intentionally NOT written to localStorage.
  const watchedValues = form.watch()
  const draftPayload = useMemo(() => {
    const { password: _password, ...rest } = watchedValues
    void _password
    return rest as Omit<CreateUserFormValues, "password">
  }, [watchedValues])
  const userDraft = useFormDraft<Omit<CreateUserFormValues, "password">>("users.new", draftPayload)
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  useEffect(() => {
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    if (userDraft.hasDraft()) {
      setDraftBannerSavedAt(userDraft.peekSavedAt())
      setDraftBannerOpen(true)
    }
  }, [userDraft])

  const handleRestoreDraft = () => {
    const d = userDraft.restore()
    if (d) {
      form.reset({ ...form.getValues(), ...d, password: form.getValues("password") })
    }
    setDraftBannerOpen(false)
    toast({
      title: "Draft restored",
      description: "Password was not saved — please re-enter it before submitting.",
    })
  }

  const handleDiscardDraft = () => {
    userDraft.clear()
    setDraftBannerOpen(false)
  }

  const selectedState = form.watch("state")
  const districts = getDistrictsForState(selectedState === OTHER ? "" : (selectedState ?? ""))
  const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }))
  const districtOptions = districts.map((d) => ({ value: d, label: d }))
  const cityOptions = selectedState && selectedState !== OTHER
    ? getCityOptionsForState(selectedState)
    : getAllCityOptions()

  const onSubmit = async (values: CreateUserFormValues) => {
    const payload: CreateUserInput = {
      ...values,
      state: values.state === OTHER ? (values.stateOther ?? "").trim() : values.state,
      district: values.district === OTHER ? (values.districtOther ?? "").trim() : values.district,
      city: values.city === OTHER ? (values.cityOther ?? "").trim() : values.city,
    }
    setIsSubmitting(true)
    try {
      const user = await createUserAction(payload)
      userDraft.clear()
      toast({
        title: "User created",
        description: `${user.name} (${roleLabel(user.role)}) was created successfully.`,
      })
      router.push("/users")
    } catch (e) {
      console.error('[onSubmit] Error creating user:', e)
      const errorMessage = e instanceof Error ? e.message : "Please try again."
      toast({
        title: "Could not create user",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <Link href="/users">
          <Button variant="ghost" className="text-foreground hover:bg-accent">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        </Link>
      </div>

      {draftBannerOpen ? (
        <div className="mb-4 max-w-2xl">
          <DraftBanner
            savedAt={draftBannerSavedAt}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
            hint="Password is not saved — please re-enter it after restoring."
          />
        </div>
      ) : null}

      <Card className="max-w-2xl border-border bg-card shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Create User</CardTitle>
          <p className="text-sm text-muted-foreground">Add a new user with full name, email, password, role, address and status.</p>
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
                    <FormLabel>Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Min 6 characters"
                          autoComplete="new-password"
                          className="pr-10"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
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
                    <Select value={field.value || " "} onValueChange={(v) => field.onChange(v === " " ? "" : v)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value=" " disabled>Select role</SelectItem>
                        {ROLES_LIST.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </SelectItem>
                        ))}
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

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={stateOptions}
                        value={field.value || ""}
                        onValueChange={(v) => {
                          field.onChange(v)
                          form.setValue("district", "")
                          form.setValue("districtOther", "")
                        }}
                        placeholder="Select state"
                        searchPlaceholder="Search state..."
                        emptyMessage="No state found."
                        otherOption={{ value: OTHER, label: OTHER }}
                      />
                    </FormControl>
                    {field.value === OTHER && (
                      <FormField
                        control={form.control}
                        name="stateOther"
                        render={({ field: f }) => (
                          <FormItem className="mt-2">
                            <FormLabel className="text-muted-foreground">Specify state</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter state" {...f} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={districtOptions}
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        placeholder={selectedState ? "Select district" : "Select state first"}
                        searchPlaceholder="Search district..."
                        emptyMessage="No district found."
                        disabled={!selectedState || selectedState === OTHER}
                        otherOption={districts.length > 0 ? { value: OTHER, label: OTHER } : undefined}
                      />
                    </FormControl>
                    {field.value === OTHER && (
                      <FormField
                        control={form.control}
                        name="districtOther"
                        render={({ field: f }) => (
                          <FormItem className="mt-2">
                            <FormLabel className="text-muted-foreground">Specify district</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter district" {...f} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
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
                      <SearchableSelect
                        options={cityOptions}
                        value={field.value === "" ? "" : (field.value || " ")}
                        onValueChange={(v) => field.onChange(v === " " ? "" : v)}
                        placeholder="Select city or Other"
                        searchPlaceholder="Search city..."
                        emptyMessage="No city found."
                        otherOption={{ value: OTHER, label: OTHER }}
                      />
                    </FormControl>
                    {field.value === OTHER && (
                      <FormField
                        control={form.control}
                        name="cityOther"
                        render={({ field: f }) => (
                          <FormItem className="mt-2">
                            <FormLabel className="text-muted-foreground">Specify city / village</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter city or village" {...f} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
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
                <p className="mb-4 text-sm font-medium text-green-800">Ready? Create user</p>
                <div className="flex flex-wrap gap-4">
                  <Button type="button" variant="outline" size="lg" onClick={() => router.push("/users")} className="border-solar text-foreground">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="min-w-[220px] bg-green-600 py-6 text-base font-semibold text-white shadow-lg hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSubmitting ? "Creating..." : "Create User"}
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

