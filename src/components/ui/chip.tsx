import { cva } from "class-variance-authority"

// A rounded label for groups: a link or a button on the list and in the card
const chipVariants = cva(
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    variants: {
      active: {
        true: "border-accent bg-accent-soft text-foreground",
        false: "border-input text-muted-foreground hover:bg-muted hover:text-foreground",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
)

export { chipVariants }
