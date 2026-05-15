"use client"

import { Suspense } from "react"

import { InstallationWizardForm } from "@/components/installation-wizard/installation-wizard-form"
import { InstallationNewPageSkeleton } from "@/components/installations-loading-skeletons"

export default function NewInstallationPage() {
  return (
    <Suspense fallback={<InstallationNewPageSkeleton />}>
      <InstallationWizardForm mode="new" />
    </Suspense>
  )
}
