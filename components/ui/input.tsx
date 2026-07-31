import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Design-system field (§5): surface-strong glass + white inset top edge,
        // radius 8px, min-height 44px; focus = indigo border + 4px soft glow.
        "h-11 w-full min-w-0 rounded-(--radius-control) border border-input bg-(--surface-strong) px-3 py-1 text-base shadow-[inset_0_1px_0_#ffffffe6] transition-[border-color,background-color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-(--fg-tertiary) focus-visible:border-(--focus-ring) focus-visible:bg-(--surface-hover) focus-visible:ring-4 focus-visible:ring-[#5157d81f] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
