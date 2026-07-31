"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        // Field labels speak the design system's eyebrow language:
        // IBM Plex Mono, 11px, uppercase, tracked out (§2).
        "flex items-center gap-2 font-mono text-[11px] leading-none font-semibold tracking-[0.12em] uppercase text-(--fg-secondary) select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
