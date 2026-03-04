import { Skeleton } from "@/components/ui/skeleton"

export default function SurveyDetailLoading() {
  return (
    <div className="min-h-screen relative">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        <Skeleton className="mb-3 h-5 w-16" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-[4.5rem] w-full rounded-lg" />
        </div>
      </main>
    </div>
  )
}
