import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Design-system buttons (docs/design-system.md §5):
 * radius 8px (--radius-control), semibold, .18s frost easing.
 * default = solid indigo with deep indigo shadow + white inset top edge;
 * outline/secondary = frosted glass surfaces. Hover lifts 2px, active drops
 * back with a compressed shadow (key-press feel).
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-(--radius-control) border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[translate,background-color,border-color,color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-black/10 bg-primary text-primary-foreground shadow-[0_18px_34px_-24px_rgba(50,56,159,.9),inset_0_1px_0_rgba(255,255,255,.2)] hover:-translate-y-0.5 hover:bg-indigo-500 active:translate-y-0 active:shadow-[0_8px_18px_-14px_rgba(50,56,159,.9),inset_0_1px_0_rgba(255,255,255,.2)]",
        outline:
          "border-border bg-card text-foreground shadow-card backdrop-blur-xl hover:-translate-y-0.5 hover:bg-(--surface-strong) active:translate-y-0 aria-expanded:bg-(--surface-strong)",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_#ffffffe6] hover:bg-(--surface-hover) aria-expanded:bg-(--surface-hover)",
        ghost:
          "hover:bg-(--surface-strong) hover:text-foreground aria-expanded:bg-(--surface-strong) aria-expanded:text-foreground",
        destructive:
          "border-(--border-danger) bg-(--surface-danger) text-(--fg-danger) hover:bg-destructive/20 focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
