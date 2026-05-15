"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STEP_LABELS = [
  "Visit",
  "Materials",
  "Commissioning",
  "Quality",
  "Faults",
  "Photos",
  "Sign off",
] as const

export type WizardShellProps = {
  mode: "new" | "edit"
  installationLabel?: string
  currentStep: number
  totalSteps?: number
  backHref: string
  backLabel: string
  children: ReactNode
  footer: ReactNode
  /** Hide middle step dots when user chose site inaccessible (fast-track to sign-off). */
  compactSteps?: boolean
}

export function WizardShell({
  mode,
  installationLabel,
  currentStep,
  totalSteps = 7,
  backHref,
  backLabel,
  children,
  footer,
  compactSteps = false,
}: WizardShellProps) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col pb-28 sm:pb-24">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-solar bg-solar-beige/50 px-3 py-3 sm:px-4">
          <Link href={backHref}>
            <Button variant="ghost" size="sm" className="text-foreground hover:bg-accent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Button>
          </Link>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {mode === "new" ? "New installation" : "Edit installation"}
            </p>
            {installationLabel ? (
              <p className="text-sm font-semibold text-foreground">{installationLabel}</p>
            ) : null}
          </div>
        </div>

        <nav aria-label="Installation steps" className="mb-6">
          <div className="hidden gap-1 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1
              const isActive = n === currentStep
              const isPast = n < currentStep
              const skipDot = compactSteps && n >= 2 && n <= 6
              if (skipDot) {
                return n === 2 ? (
                  <span
                    key="ellipsis"
                    className="px-1 text-xs text-muted-foreground"
                    title="Steps skipped — site not accessible"
                  >
                    …
                  </span>
                ) : null
              }
              return (
                <div
                  key={label}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-1 border-b-2 pb-2 text-center",
                    isActive ? "border-green-600 text-foreground" : "border-transparent text-muted-foreground",
                    isPast && !isActive && "text-foreground/80"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isActive ? "bg-green-600 text-white" : isPast ? "bg-green-100 text-green-900" : "bg-muted"
                    )}
                  >
                    {n}
                  </span>
                  <span className="hidden text-[10px] font-medium leading-tight sm:block md:text-[11px]">{label}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-2 sm:hidden" aria-hidden>
            <span className="text-sm font-semibold text-foreground">
              Step {currentStep} / {totalSteps}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="max-w-[200px] truncate text-sm text-muted-foreground">
              {STEP_LABELS[currentStep - 1]}
            </span>
          </div>
        </nav>

        <div className="space-y-4">{children}</div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-solar bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2">{footer}</div>
      </div>
    </div>
  )
}
