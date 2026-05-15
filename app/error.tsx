"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[SolarEPC app error]", error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-6 py-12 font-sans text-foreground">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A client error occurred. Use the button below, then try a hard refresh. Safari Private Mode or a strict
          content‑security policy can block required scripts — open the site in a normal window or allow scripts for
          this domain if the problem persists.
        </p>
        {process.env.NODE_ENV === "development" ? (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left text-xs">{error.message}</pre>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          onClick={() => reset()}
        >
          Try again
        </button>
        <a href="/" className="text-sm font-medium text-green-800 underline underline-offset-4 hover:text-green-900">
          Back to login
        </a>
      </div>
    </div>
  )
}
