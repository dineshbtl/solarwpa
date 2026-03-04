import { Skeleton } from "@/components/ui/skeleton"

export default function SurveysLoading() {
  return (
    <div className="min-h-screen p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-1 h-3 w-36" />
        </div>
      </div>
      <div className="mb-4 rounded-xl border border-border bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-[100px]" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="mb-2 flex justify-between">
          <Skeleton className="h-3 w-20" />
          <div className="flex gap-1">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-10" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex gap-1 border-b pb-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 flex-1 min-w-[30px]" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-1">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-5 flex-1 min-w-[30px]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
