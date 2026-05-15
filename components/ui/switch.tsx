'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-[1.2rem] w-9 shrink-0 items-center rounded-full border-2 border-foreground/25 bg-muted transition-[background-color,border-color,box-shadow] outline-none data-[state=checked]:border-primary data-[state=checked]:bg-primary/90 data-[state=unchecked]:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={
          'pointer-events-none block size-3.5 rounded-full bg-background ring-0 shadow-sm transition-transform data-[state=checked]:translate-x-[calc(100%+1px)] data-[state=unchecked]:translate-x-[1px]'
        }
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
