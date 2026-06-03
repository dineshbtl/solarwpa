"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { InstallationWizardForm } from "@/components/installation-wizard/installation-wizard-form"
import { Skeleton } from "@/components/ui/skeleton"

function InstallationEditContent() {
  const searchParams = useSearchParams()
  const id = searchParams?.get("id") ?? null

  return <InstallationWizardForm mode="edit" installationId={id} />
}

export default function EditInstallationPage() {
  return (
    <Suspense fallback={<Skeleton className="h-20 w-full" />}>
      <InstallationEditContent />
    </Suspense>
  )
}
