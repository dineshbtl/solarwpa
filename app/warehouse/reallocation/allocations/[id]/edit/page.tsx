"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useFormDraft } from "@/lib/store/use-form-draft"
import { DraftBanner } from "@/components/draft-banner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { SurveySelect } from "@/components/survey-select"
import type { Survey } from "@/lib/store/surveys"
import { getHouseDeliveryById, listMaterialDefinitions, updateHouseDelivery, type MaterialDefinition } from "@/lib/supabase/warehouse"
import type { HouseMaterialDeliveryStatus } from "@/lib/store/warehouse"
import { getSurveyByIdFromSupabase } from "@/lib/supabase/surveys"

function parseSerialText(input: string): string[] {
  return [...new Set(input.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))]
}

export default function EditAllocationPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [materials, setMaterials] = useState<MaterialDefinition[]>([])
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [materialName, setMaterialName] = useState("")
  const [status, setStatus] = useState<HouseMaterialDeliveryStatus>("allocated")
  const [qty, setQty] = useState("")
  const [unit, setUnit] = useState("Nos")
  const [serialsText, setSerialsText] = useState("")
  const [notes, setNotes] = useState("")

  // Persist text-only fields. Survey identity is captured by surveyId so we can re-look-up after restore.
  const draftPayload = useMemo(
    () => ({
      surveyId: survey?.id ?? "",
      materialName,
      status,
      qty,
      unit,
      serialsText,
      notes,
    }),
    [survey?.id, materialName, status, qty, unit, serialsText, notes],
  )
  const [draftEnabled, setDraftEnabled] = useState(false)
  const allocationDraft = useFormDraft<typeof draftPayload>(
    id ? `warehouse.allocations.edit.${id}` : "warehouse.allocations.edit.__unknown__",
    draftPayload,
    { enabled: draftEnabled && !!id },
  )
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  const handleRestoreDraft = async () => {
    const d = allocationDraft.restore()
    if (d) {
      setMaterialName(d.materialName ?? "")
      setStatus((d.status as HouseMaterialDeliveryStatus) ?? "allocated")
      setQty(d.qty ?? "")
      setUnit(d.unit ?? "Nos")
      setSerialsText(d.serialsText ?? "")
      setNotes(d.notes ?? "")
      // If the user had switched to a different household before the page hung, re-look it up.
      if (d.surveyId && d.surveyId !== survey?.id) {
        try {
          const fresh = await getSurveyByIdFromSupabase(d.surveyId)
          if (fresh) setSurvey(fresh)
        } catch {
          // ignore — user can re-pick the household
        }
      }
    }
    setDraftBannerOpen(false)
    setDraftEnabled(true)
    toast({ title: "Draft restored" })
  }

  const handleDiscardDraft = () => {
    allocationDraft.clear()
    setDraftBannerOpen(false)
    setDraftEnabled(true)
  }

  useEffect(() => {
    if (!id) return
    // Hydrate from server exactly once per mount. allocationDraft must not be in deps —
    // it returns a new reference on every debounced write and would re-trigger the load.
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    Promise.all([getHouseDeliveryById(id), listMaterialDefinitions()])
      .then(async ([delivery, mats]) => {
        if (!delivery) {
          toast({ title: "Allocation not found", variant: "destructive" })
          router.push("/warehouse/reallocation/allocations")
          return
        }
        setMaterials(mats)
        const fullSurvey = await getSurveyByIdFromSupabase(delivery.toHouseholdId)
        setSurvey(
          fullSurvey ??
            ({
              id: delivery.toHouseholdId,
              beneficiaryName: "Unknown household",
              serviceNo: "N/A",
            } as Survey)
        )
        setMaterialName(delivery.materialName)
        setStatus(delivery.status)
        setQty(String(delivery.qty))
        setUnit(delivery.unit ?? "Nos")
        setSerialsText((delivery.serialNos ?? []).join("\n"))
        setNotes(delivery.notes ?? "")
        if (allocationDraft.hasDraft()) {
          setDraftBannerSavedAt(allocationDraft.peekSavedAt())
          setDraftBannerOpen(true)
        } else {
          setDraftEnabled(true)
        }
      })
      .catch((err) =>
        toast({
          title: "Could not load allocation",
          description: err instanceof Error ? err.message : "Please refresh.",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false))
    // allocationDraft intentionally omitted — guarded by draftCheckedRef above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  const onSave = async () => {
    if (!survey?.id) {
      toast({ title: "Select household", variant: "destructive" })
      return
    }
    if (!materialName.trim()) {
      toast({ title: "Select material", variant: "destructive" })
      return
    }
    const serialNos = parseSerialText(serialsText)
    const parsedQty = Number(qty)
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      toast({ title: "Enter valid quantity", variant: "destructive" })
      return
    }
    if (serialNos.length > 0 && serialNos.length !== parsedQty) {
      toast({
        title: "Quantity mismatch",
        description: "Quantity must match serial count when serials are provided.",
        variant: "destructive",
      })
      return
    }
    setSubmitting(true)
    try {
      await updateHouseDelivery(id, {
        toHouseholdId: survey.id,
        materialName: materialName.trim(),
        qty: parsedQty,
        unit: unit.trim() || "Nos",
        serialNos,
        status,
        notes: notes.trim() || undefined,
      })
      allocationDraft.clear()
      toast({ title: "Allocation updated" })
      router.push("/warehouse/reallocation/allocations")
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading allocation...
      </div>
    )
  }

  return (
    <div className="w-full px-3 py-4 sm:px-6 sm:py-8 lg:px-8 pb-24">
      <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6 sm:gap-3">
        <Link href="/warehouse/reallocation/allocations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Allocation List
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Edit Allocation</h1>
          <p className="text-sm text-muted-foreground">Update household allocation details</p>
        </div>
      </div>

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

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Allocation Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <div>
            <Label>Household</Label>
            <div className="mt-2">
              <SurveySelect value={survey?.id ?? ""} selectedSurvey={survey} onSelect={setSurvey} placeholder="Select household" />
            </div>
          </div>
          <div>
            <Label>Material</Label>
            <Select value={materialName} onValueChange={setMaterialName}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.name}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as HouseMaterialDeliveryStatus)}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allocated">Allocated</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="reassigned">Reassigned</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Qty</Label>
            <Input className="mt-2" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label>Unit</Label>
            <Input className="mt-2" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Serial Nos (one per line)</Label>
            <Textarea className="mt-2 h-28 sm:h-32 overflow-y-auto" value={serialsText} onChange={(e) => setSerialsText(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea className="mt-2 min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href="/warehouse/reallocation/allocations">
              <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
            </Link>
            <Button onClick={onSave} disabled={submitting} className="w-full sm:w-auto">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
