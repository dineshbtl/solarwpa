"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useFormDraft } from "@/lib/store/use-form-draft"
import { DraftBanner } from "@/components/draft-banner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { createAllotment } from "@/lib/supabase/warehouse"
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"

const today = () => new Date().toISOString().split("T")[0]

export default function NewAllotmentPage() {
  const router = useRouter()
  const [mandal, setMandal] = useState("")
  const [villageName, setVillageName] = useState("")
  const [engineerId, setEngineerId] = useState("")
  const [householdsAllotted, setHouseholdsAllotted] = useState<number>(0)
  const [allottedDate, setAllottedDate] = useState(today())
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const draftPayload = useMemo(
    () => ({ mandal, villageName, engineerId, householdsAllotted, allottedDate, notes }),
    [mandal, villageName, engineerId, householdsAllotted, allottedDate, notes],
  )
  const allotmentDraft = useFormDraft<typeof draftPayload>("warehouse.allotments.new", draftPayload)
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  useEffect(() => {
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    if (allotmentDraft.hasDraft()) {
      setDraftBannerSavedAt(allotmentDraft.peekSavedAt())
      setDraftBannerOpen(true)
    }
  }, [allotmentDraft])

  const handleRestoreDraft = () => {
    const d = allotmentDraft.restore()
    if (d) {
      setMandal(d.mandal ?? "")
      setVillageName(d.villageName ?? "")
      setEngineerId(d.engineerId ?? "")
      setHouseholdsAllotted(typeof d.householdsAllotted === "number" ? d.householdsAllotted : 0)
      setAllottedDate(d.allottedDate ?? today())
      setNotes(d.notes ?? "")
    }
    setDraftBannerOpen(false)
    toast({ title: "Draft restored" })
  }

  const handleDiscardDraft = () => {
    allotmentDraft.clear()
    setDraftBannerOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mandal.trim() || !villageName.trim() || !engineerId.trim() || !householdsAllotted) {
      toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      await createAllotment({
        projectId: ACTIVE_PROJECT_ID,
        mandal: mandal.trim(),
        villageName: villageName.trim(),
        engineerId: engineerId.trim(),
        householdsAllotted,
        allottedDate,
        notes: notes.trim() || undefined,
      })
      allotmentDraft.clear()
      toast({ title: "Allotment created", description: `${villageName} allotted to ${engineerId}.` })
      router.push("/warehouse/allotments")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full px-3 py-4 pb-28 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mb-8">
        <Link href="/warehouse/allotments" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Allotments
        </Link>
        <h1 className="text-3xl font-bold text-foreground">New Allotment</h1>
        <p className="mt-1 text-muted-foreground">Assign an installation engineer to a village</p>
      </div>

      {draftBannerOpen ? (
        <div className="mb-4 max-w-3xl">
          <DraftBanner
            savedAt={draftBannerSavedAt}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
            hint=""
          />
        </div>
      ) : null}

      <form id="allotments-new-form" onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allotment Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mandal">Mandal *</Label>
              <Input id="mandal" placeholder="e.g. Kalluru" value={mandal} onChange={(e) => setMandal(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="village">Village Name *</Label>
              <Input id="village" placeholder="e.g. A.Gokulapadu" value={villageName} onChange={(e) => setVillageName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="engineerId">Engineer ID *</Label>
              <Input id="engineerId" placeholder="e.g. ENG-001" value={engineerId} onChange={(e) => setEngineerId(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="households">Households Allotted *</Label>
              <Input id="households" type="number" min={1} placeholder="e.g. 120" value={householdsAllotted || ""} onChange={(e) => setHouseholdsAllotted(Number(e.target.value))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={allottedDate} onChange={(e) => setAllottedDate(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Notes (Optional)</CardTitle></CardHeader>
          <CardContent>
            <Textarea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </CardContent>
        </Card>

        <div className="hidden justify-end gap-3 sm:flex">
          <Link href="/warehouse/allotments"><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={submitting} className="bg-solar-dark text-white hover:bg-solar-dark/90">
            {submitting ? "Saving…" : "Create Allotment"}
          </Button>
        </div>
      </form>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Link href="/warehouse/allotments" className="flex-1">
            <Button type="button" variant="outline" className="w-full">Cancel</Button>
          </Link>
          <Button type="submit" form="allotments-new-form" disabled={submitting} className="flex-1 bg-solar-dark text-white hover:bg-solar-dark/90">
            {submitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
