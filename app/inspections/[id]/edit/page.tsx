"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import * as inspectionsData from "@/lib/data/inspections"
import { useUsers } from "@/lib/data/hooks"
import { InspectionEditPageSkeleton } from "@/components/inspections-loading-skeletons"
import { useFormDraft } from "@/lib/store/use-form-draft"
import { DraftBanner } from "@/components/draft-banner"

export default function EditInspectionPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [customerName, setCustomerName] = useState("")
  const [address, setAddress] = useState("")
  const [inspectorId, setInspectorId] = useState<string>("__none__")

  const { data: users = [] } = useUsers()
  const getUserById = useCallback(
    (uid: string | undefined) => (uid ? users.find((u) => u.id === uid) : undefined),
    [users]
  )

  const inspectorOptions = useMemo(() => users.filter((u) => u.role === "government"), [users])

  // Local draft so a hung save doesn't drop the user's edits.
  const draftPayload = useMemo(
    () => ({ customerName, address, inspectorId }),
    [customerName, address, inspectorId],
  )
  const [draftEnabled, setDraftEnabled] = useState(false)
  const inspectionDraft = useFormDraft<typeof draftPayload>(
    id ? `inspections.edit.${id}` : "inspections.edit.__unknown__",
    draftPayload,
    { enabled: draftEnabled && !!id },
  )
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleRestoreDraft = () => {
    const d = inspectionDraft.restore()
    if (d) {
      setCustomerName(d.customerName ?? "")
      setAddress(d.address ?? "")
      setInspectorId(d.inspectorId ?? "__none__")
    }
    setDraftBannerOpen(false)
    setDraftEnabled(true)
    toast({ title: "Draft restored" })
  }

  const handleDiscardDraft = () => {
    inspectionDraft.clear()
    setDraftBannerOpen(false)
    setDraftEnabled(true)
  }

  useEffect(() => {
    if (!id) return
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    const loadData = async () => {
      try {
        const insp = await inspectionsData.getInspectionById(id)
        if (!insp) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setCustomerName(insp.customerName ?? "")
        setAddress(insp.address ?? "")
        setInspectorId(insp.inspectorId ?? "__none__")
      } catch (e) {
        console.error("Error loading inspection:", e)
        setNotFound(true)
      }
      if (inspectionDraft.hasDraft()) {
        setDraftBannerSavedAt(inspectionDraft.peekSavedAt())
        setDraftBannerOpen(true)
      } else {
        setDraftEnabled(true)
      }
      setLoading(false)
    }
    loadData()
    // inspectionDraft is intentionally omitted — its identity changes on every debounced
    // write, but draftCheckedRef ensures we hydrate exactly once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleSave = async () => {
    if (!id) return
    if (!customerName.trim() || !address.trim()) {
      toast({
        title: "Missing details",
        description: "Please fill customer name and address.",
        variant: "destructive",
      })
      return
    }
    setIsSaving(true)
    try {
      const nextInspectorId = inspectorId === "__none__" ? undefined : inspectorId
      await inspectionsData.updateInspectionDetails(id, { customerName, address, inspectorId: nextInspectorId })
      inspectionDraft.clear()
      toast({ title: "Inspection updated" })
      router.push(`/inspections/${id}`)
    } catch (e) {
      toast({
        title: "Could not update inspection",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return <InspectionEditPageSkeleton />
  }

  if (notFound) {
    return (
      <div className="min-h-screen p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">Inspection not found.</p>
        <div className="mt-4">
          <Link href="/inspections">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </div>
    )
  }

  const currentInspector =
    inspectorId !== "__none__" ? getUserById(inspectorId)?.name ?? inspectorId : "Unassigned"

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href={`/inspections/${id}`}>
          <Button variant="ghost" className="mb-6 text-foreground hover:bg-accent">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inspection
          </Button>
        </Link>

        {draftBannerOpen ? (
          <div className="mb-4">
            <DraftBanner
              savedAt={draftBannerSavedAt}
              onRestore={handleRestoreDraft}
              onDiscard={handleDiscardDraft}
              hint=""
            />
          </div>
        ) : null}

        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">Edit Inspection</CardTitle>
            <p className="text-sm text-muted-foreground">Update inspection details and inspector assignment.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-foreground">Customer Name</Label>
                <Input
                  className="mt-2 border-solar bg-background"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer / homeowner"
                />
              </div>
              <div>
                <Label className="text-foreground">Inspector (Gov role)</Label>
                <Select value={inspectorId} onValueChange={setInspectorId}>
                  <SelectTrigger className="mt-2 border-solar bg-background">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {inspectorOptions.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Current: {currentInspector}</p>
              </div>
            </div>

            <div>
              <Label className="text-foreground">Address</Label>
              <Input
                className="mt-2 border-solar bg-background"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Inspection address"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => router.push(`/inspections/${id}`)}>
                Cancel
              </Button>
              <Button type="button" disabled={isSaving} className="bg-gradient-primary-button text-white hover:opacity-90" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

