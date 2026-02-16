import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('rounded-md bg-gray-200 animate-pulse dark:bg-gray-700', className)}
      {...props}
    />
  )
}

export { Skeleton }
