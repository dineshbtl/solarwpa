"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { getInspectionById, updateInspectionDetails } from "@/lib/store/inspections"
import { getUserById, listUsers, seedUsers } from "@/lib/store/users"

export default function EditInspectionPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [customerName, setCustomerName] = useState("")
  const [address, setAddress] = useState("")
  const [inspectorId, setInspectorId] = useState<string>("__none__")

  useEffect(() => {
    seedUsers()
  }, [])

  const inspectorOptions = useMemo(() => listUsers().filter((u) => u.role === "government"), [])

  useEffect(() => {
    if (!id) return
    const insp = getInspectionById(id)
    if (!insp) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setCustomerName(insp.customerName ?? "")
    setAddress(insp.address ?? "")
    setInspectorId(insp.inspectorId ?? "__none__")
    setLoading(false)
  }, [id])

  const handleSave = () => {
    if (!id) return
    if (!customerName.trim() || !address.trim()) {
      toast({
        title: "Missing details",
        description: "Please fill customer name and address.",
        variant: "destructive",
      })
      return
    }
    try {
      const nextInspectorId = inspectorId === "__none__" ? undefined : inspectorId
      updateInspectionDetails(id, { customerName, address, inspectorId: nextInspectorId })
      toast({ title: "Inspection updated" })
      router.push(`/inspections/${id}`)
    } catch (e) {
      toast({
        title: "Could not update inspection",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background p-6 sm:p-8">
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
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href={`/inspections/${id}`}>
          <Button variant="ghost" className="mb-6 text-solar-dark hover:bg-solar-beige">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inspection
          </Button>
        </Link>

        <Card className="border-border bg-white shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">Edit Inspection</CardTitle>
            <p className="text-sm text-muted-foreground">Update inspection details and inspector assignment.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-solar-dark">Customer Name</Label>
                <Input
                  className="mt-2 border-solar bg-background"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer / homeowner"
                />
              </div>
              <div>
                <Label className="text-solar-dark">Inspector (Gov role)</Label>
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
              <Label className="text-solar-dark">Address</Label>
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
              <Button type="button" className="bg-gradient-primary-button text-white hover:opacity-90" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

