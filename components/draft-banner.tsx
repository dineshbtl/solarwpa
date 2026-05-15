'use client'

import { History, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/** Pretty relative-time string for "saved 12s ago" — degrades to absolute time after 24h. */
function formatSavedAt(savedAt: string): string {
  const t = new Date(savedAt).getTime()
  if (Number.isNaN(t)) return ''
  const deltaMs = Date.now() - t
  if (deltaMs < 60_000) return 'just now'
  const m = Math.round(deltaMs / 60_000)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  return new Date(savedAt).toLocaleString()
}

type Props = {
  /** ISO timestamp of when the draft was saved. */
  savedAt: string | null
  /** Called when the user clicks "Restore". */
  onRestore: () => void
  /** Called when the user clicks "Discard". */
  onDiscard: () => void
  /** Override the banner title (default: "Unsaved changes found"). */
  title?: string
  /** Hint shown under the title — e.g. "Photos may need to be re-attached." */
  hint?: string
  /** Tailwind class override for the wrapper. */
  className?: string
}

/**
 * Restore-or-discard banner shown when a form mounts and a saved draft is detected in localStorage.
 *
 * Designed to live at the top of any CRUD form, just under the page heading. The parent owns the
 * "is this banner visible?" state — typically a useState seeded from `useFormDraft().hasDraft()`.
 */
export function DraftBanner({
  savedAt,
  onRestore,
  onDiscard,
  title = 'Unsaved changes found',
  hint = 'Photos may need to be re-attached if you restore.',
  className,
}: Props) {
  const when = savedAt ? formatSavedAt(savedAt) : ''
  return (
    <Alert className={className} data-slot="draft-banner">
      <History aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>
          {when ? <>We saved a local draft of this form {when}. </> : <>We found a local draft of this form. </>}
          {hint}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onRestore} className="bg-gradient-primary-button text-white hover:opacity-90">
            Restore draft
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDiscard}>
            <X className="mr-1 h-3.5 w-3.5" /> Discard
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
