"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Save, Loader2, Eye, EyeOff } from "lucide-react"
import { useForm } from "react-hook-form"
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
import type { Permission, Role } from "@/lib/rbac"
import { normalizeAppRole, permissionLabel, permissionsForRoleFromMap, roleLabel, ROLE_LABEL, ROLES_LIST } from "@/lib/rbac"
import {
  UpdateUserSchema,
  type UpdateUserInput,
} from "@/lib/store/users"
import { INDIAN_STATES, OTHER, getDistrictsForState, STATE_DISTRICTS } from "@/lib/data/india-locations"
import { getCityOptionsForState, getAllCityOptions } from "@/lib/data/indian-cities"
import { useUser } from "@/lib/data/hooks"
import { updateUserAction } from "@/app/users/actions"
import { useRole } from "@/contexts/role-context"
import { UserEditPageSkeleton } from "@/components/users-loading-skeletons"

type FormValues = UpdateUserInput & { password?: string; stateOther?: string; districtOther?: string; cityOther?: string; assignedLocations?: string[] }

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ?? null
  const { permissionMap } = useRole()
  const { data: loadedUser, loading, error: loadError } = useUser(id)

  const form = useForm<FormValues>({
    resolver: zodResolver(UpdateUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "installer",
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
      assignedLocations: [],
    },
    mode: "onTouched",
  })

  const watchedValues = form.watch()
  const draftPayload = useMemo(() => {
    const { password: _password, ...rest } = watchedValues
    void _password
    return rest as Omit<FormValues, "password">
  }, [watchedValues])
  const [draftEnabled, setDraftEnabled] = useState(false)
  const userDraft = useFormDraft<Omit<FormValues, "password">>(
    id ? `users.edit.${id}` : "users.edit.__unknown__",
    draftPayload,
    { enabled: draftEnabled && !!id },
  )
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  const handleRestoreDraft = () => {
    const d = userDraft.restore()
    if (d) form.reset({ ...form.getValues(), ...d, password: "" })
    setDraftBannerOpen(false)
    setDraftEnabled(true)
    toast({ title: "Draft restored", description: "Password is unchanged." })
  }

  const handleDiscardDraft = () => {
    userDraft.clear()
    setDraftBannerOpen(false)
    setDraftEnabled(true)
  }

  const hydratedForUserIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!loadedUser) return
    if (hydratedForUserIdRef.current === loadedUser.id) return
    hydratedForUserIdRef.current = loadedUser.id
    const u = loadedUser
    const stateVal = u.state ?? ""
    const districtVal = u.district ?? ""
    const cityVal = u.city ?? ""
    const stateFromList = INDIAN_STATES.includes(stateVal as (typeof INDIAN_STATES)[number])
    const districtFromList = stateFromList && getDistrictsForState(stateVal).includes(districtVal)
    form.reset({
      name: u.name,
      email: u.email,
      password: "",
      role: normalizeAppRole(u.role) ?? "installer",
      status: u.status ?? "active",
      phone: u.phone ?? "",
      aadharNo: u.aadharNo ?? "",
      city: cityVal ? OTHER : " ",
      state: stateFromList ? stateVal : (stateVal ? OTHER : ""),
      district: districtFromList ? districtVal : (districtVal ? OTHER : ""),
      stateOther: stateFromList ? "" : stateVal,
      districtOther: districtFromList ? "" : districtVal,
      cityOther: cityVal ?? "",
      fullAddress: u.fullAddress ?? "",
      assignedLocations: u.assignedLocations ?? [],
    })
    if (userDraft.hasDraft()) {
      setDraftBannerSavedAt(userDraft.peekSavedAt())
      setDraftBannerOpen(true)
    } else {
      setDraftEnabled(true)
    }
    // userDraft intentionally omitted — id-guard above prevents re-hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedUser, form])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const selectedState = form.watch("state")
  const selectedRole = form.watch("role") as Role
  const installationPermissionsForRole = (
    ["create_installations", "update_installations"] as Permission[]
  ).filter((k) => permissionsForRoleFromMap(selectedRole, permissionMap).includes(k))
  const districts = getDistrictsForState(selectedState === OTHER ? "" : (selectedState ?? ""))
  const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }))
  const districtOptions = districts.map((d) => ({ value: d, label: d }))
  const cityOptions = selectedState && selectedState !== OTHER
    ? getCityOptionsForState(selectedState)
    : getAllCityOptions()

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
        city: values.city === OTHER ? (values.cityOther ?? "").trim() : (values.city ?? ""),
        state: values.state === OTHER ? (values.stateOther ?? "").trim() : (values.state ?? ""),
        district: values.district === OTHER ? (values.districtOther ?? "").trim() : (values.district ?? ""),
        fullAddress: values.fullAddress ?? "",
        assignedLocations: values.assignedLocations ?? [],
      }
      if (values.password && values.password.trim() !== "") {
        payload.password = values.password
      }
      const updated = await updateUserAction(id, payload)
      userDraft.clear()
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

  if (!id) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-muted-foreground">Invalid user.</p>
        <Link href="/users">
          <Button variant="outline" className="mt-4">Back to Users</Button>
        </Link>
      </div>
    )
  }

  if (loading) {
    return <UserEditPageSkeleton />
  }

  if (loadError) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-destructive">Could not load user. Please refresh.</p>
        <Link href="/users">
          <Button variant="outline" className="mt-4">Back to Users</Button>
        </Link>
      </div>
    )
  }

  if (!loadedUser) {
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

      {draftBannerOpen ? (
        <div className="mb-4 max-w-2xl">
          <DraftBanner
            savedAt={draftBannerSavedAt}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
            hint="Password field is not saved — fill it again only if you want to change it."
          />
        </div>
      ) : null}

      <Card className="max-w-2xl border-border bg-card shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Edit User</CardTitle>
          <p className="text-sm text-muted-foreground">Update full name, email, password (optional), role, address and status.</p>
        </CardHeader>
        <CardContent>
          <Form {...form} key={id}>
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
                  <FormItem id="password-section">
                    <FormLabel>Password (leave blank to keep current)</FormLabel>
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
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as Role)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Installation permissions (from role)</p>
                <p className="mt-1 text-muted-foreground">
                  {installationPermissionsForRole.length > 0
                    ? installationPermissionsForRole.map((k) => permissionLabel(k)).join(" · ")
                    : "This role does not include create or update installation permissions."}
                </p>
              </div>

              {selectedRole === "installer" && (
                <FormField
                  control={form.control}
                  name="assignedLocations"
                  render={({ field }) => {
                    const allDistricts = Object.values(STATE_DISTRICTS).flat().sort()
                    const selectedLocs = field.value ?? []
                    const toggleLocation = (loc: string, checked: boolean) => {
                      if (checked) {
                        field.onChange([...selectedLocs, loc])
                      } else {
                        field.onChange(selectedLocs.filter((l) => l !== loc))
                      }
                    }
                    return (
                      <FormItem>
                        <FormLabel>Assigned Installation Locations (Districts)</FormLabel>
                        <p className="text-xs text-muted-foreground mb-2">
                          Installer can only view and create installations in these districts. Leave empty to allow all locations.
                        </p>
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-3 space-y-2">
                          {allDistricts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No districts available</p>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {allDistricts.map((district) => (
                                <label
                                  key={district}
                                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedLocs.includes(district)}
                                    onChange={(e) => toggleLocation(district, e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="truncate">{district}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        {selectedLocs.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedLocs.length} location(s) selected: {selectedLocs.slice(0, 3).join(", ")}
                            {selectedLocs.length > 3 && ` +${selectedLocs.length - 3} more`}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              )}

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
