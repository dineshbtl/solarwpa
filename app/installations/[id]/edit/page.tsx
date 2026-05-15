"use client"

import { useParams } from "next/navigation"
import { InstallationWizardForm } from "@/components/installation-wizard/installation-wizard-form"

export default function EditInstallationPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? null

  return <InstallationWizardForm mode="edit" installationId={id} />
}
