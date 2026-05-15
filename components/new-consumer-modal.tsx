"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import * as surveysData from "@/lib/data/surveys"
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"

interface NewConsumerForm {
  beneficiaryName: string
  serviceNo: string
  aadharNo: string
  mobile: string
  discomName: "APSPDCL" | "APCPDCL" | "APEPDCL"
  district: string
  pinCode: string
}

const DEFAULT_FORM: NewConsumerForm = {
  beneficiaryName: "",
  serviceNo: "",
  aadharNo: "",
  mobile: "",
  discomName: "APSPDCL",
  district: "",
  pinCode: "",
}

export function NewConsumerModal({
  open,
  onClose,
  onCreated,
  projectId,
}: {
  open: boolean
  onClose: () => void
  onCreated: (surveyId: string, beneficiaryName: string) => void
  projectId?: string
}) {
  const [form, setForm] = useState<NewConsumerForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof NewConsumerForm, string>>>({})

  const handleClose = () => {
    setForm(DEFAULT_FORM)
    setErrors({})
    onClose()
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof NewConsumerForm, string>> = {}
    if (!form.beneficiaryName.trim()) errs.beneficiaryName = "Name is required"
    if (!form.serviceNo.trim()) errs.serviceNo = "Service No is required"
    if (!form.aadharNo.trim()) errs.aadharNo = "Aadhaar No is required"
    else if (!/^\d{12}$/.test(form.aadharNo.trim())) errs.aadharNo = "Aadhaar must be 12 digits"
    if (form.mobile.trim() && !/^\d{10,15}$/.test(form.mobile.trim()))
      errs.mobile = "Mobile must be 10–15 digits"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const survey = await surveysData.createSurvey(
        {
          beneficiaryName: form.beneficiaryName.trim(),
          serviceNo: form.serviceNo.trim(),
          aadharNo: form.aadharNo.trim(),
          mobile: form.mobile.trim() || undefined,
          discomName: form.discomName,
          plantType: "On Grid",
          buildingHeight: 0,
          totalRoofs: "G",
          roofType: "RCC",
          siteLocation: {
            district: form.district.trim() || undefined,
            pinCode: form.pinCode.trim() || undefined,
          },
          bankDetails: {},
        },
        {},
        undefined,
        undefined,
        undefined
      )
      toast({ title: "Consumer created", description: `Survey ${survey.id} created.` })
      onCreated(survey.id, survey.beneficiaryName)
      handleClose()
    } catch (err) {
      toast({
        title: "Could not create consumer",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const set = (field: keyof NewConsumerForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Consumer</DialogTitle>
        </DialogHeader>
        <form id="new-consumer-form" onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="nc-name">Beneficiary Name *</Label>
            <Input
              id="nc-name"
              value={form.beneficiaryName}
              onChange={set("beneficiaryName")}
              className="mt-1 border-solar"
              placeholder="Full name"
            />
            {errors.beneficiaryName && (
              <p className="mt-1 text-xs text-destructive">{errors.beneficiaryName}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nc-service">Service No *</Label>
              <Input
                id="nc-service"
                value={form.serviceNo}
                onChange={set("serviceNo")}
                className="mt-1 border-solar"
                placeholder="e.g. 123456789"
              />
              {errors.serviceNo && (
                <p className="mt-1 text-xs text-destructive">{errors.serviceNo}</p>
              )}
            </div>
            <div>
              <Label htmlFor="nc-mobile">Mobile</Label>
              <Input
                id="nc-mobile"
                value={form.mobile}
                onChange={set("mobile")}
                className="mt-1 border-solar"
                placeholder="10-digit mobile"
              />
              {errors.mobile && (
                <p className="mt-1 text-xs text-destructive">{errors.mobile}</p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="nc-aadhar">Aadhaar No *</Label>
            <Input
              id="nc-aadhar"
              value={form.aadharNo}
              onChange={set("aadharNo")}
              className="mt-1 border-solar"
              placeholder="12-digit Aadhaar"
              maxLength={12}
            />
            {errors.aadharNo && (
              <p className="mt-1 text-xs text-destructive">{errors.aadharNo}</p>
            )}
          </div>
          <div>
            <Label>DISCOM *</Label>
            <Select
              value={form.discomName}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, discomName: v as NewConsumerForm["discomName"] }))
              }
            >
              <SelectTrigger className="mt-1 border-solar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APSPDCL">APSPDCL</SelectItem>
                <SelectItem value="APCPDCL">APCPDCL</SelectItem>
                <SelectItem value="APEPDCL">APEPDCL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nc-district">District</Label>
              <Input
                id="nc-district"
                value={form.district}
                onChange={set("district")}
                className="mt-1 border-solar"
                placeholder="e.g. Guntur"
              />
            </div>
            <div>
              <Label htmlFor="nc-pincode">Pin Code</Label>
              <Input
                id="nc-pincode"
                value={form.pinCode}
                onChange={set("pinCode")}
                className="mt-1 border-solar"
                placeholder="6-digit pin"
                maxLength={6}
              />
            </div>
          </div>
        </form>
        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="new-consumer-form"
            disabled={saving}
            className="bg-solar-dark text-white hover:bg-solar-dark/90"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Creating..." : "Create Consumer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
