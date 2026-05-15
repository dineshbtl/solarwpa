"use client"

import type React from "react"
import { forwardRef } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ScanInputProps = Omit<React.ComponentProps<typeof Input>, "autoComplete"> & {
  /** Screen-reader hint — barcode wedge keyboards emit plain keystrokes */
  scanHint?: string
}

/**
 * Keyboard-wedge friendly single-line input for USB / Bluetooth barcode scanners.
 * Auto-complete off; Enter typically fires after scan (scanner-dependent).
 */
export const ScanInput = forwardRef<HTMLInputElement, ScanInputProps>(function ScanInput(
  { className, scanHint = "Scan barcode with wedge scanner", placeholder = "Scan barcode…", ...props },
  ref
) {
  return (
    <Input
      ref={ref}
      type="text"
      inputMode="none"
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      aria-description={scanHint}
      placeholder={placeholder}
      className={cn("font-mono text-sm tabular-nums", className)}
      {...props}
    />
  )
})
