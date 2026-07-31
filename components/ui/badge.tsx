import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Design-system pill/eyebrow (§5): IBM Plex Mono, uppercase, tracked-out,
 * 11px semibold. default = indigo pill; success/destructive/warning use the
 * status surface+border+fg triads from the token set.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.08em] uppercase whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-(--pill-border) bg-(--pill-bg) text-(--pill-fg)",
        secondary:
          "border-border bg-secondary text-(--fg-secondary) [a]:hover:bg-(--surface-hover)",
        destructive:
          "border-(--border-danger) bg-(--surface-danger) text-(--fg-danger)",
        success:
          "border-(--border-success) bg-(--surface-success) text-(--fg-success)",
        warning:
          "border-(--border-warning) bg-(--surface-warning) text-(--fg-warning)",
        outline: "border-border text-foreground [a]:hover:bg-muted",
        ghost:
          "hover:bg-muted hover:text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
