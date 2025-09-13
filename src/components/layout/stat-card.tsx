
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div"
    return (
      <Comp
        ref={ref}
        className={cn(
          "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-4 text-center text-sm shadow-sm",
          className
        )}
        {...props}
      />
    )
  }
)
StatCard.displayName = "StatCard"

const StatCardIcon = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    icon: LucideIcon
  }
>(({ className, icon: Icon, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary",
        className
      )}
      {...props}
    >
      <Icon className="h-6 w-6" />
    </div>
  )
})
StatCardIcon.displayName = "StatCardIcon"

const StatCardLabel = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
})
StatCardLabel.displayName = "StatCardLabel"

const StatCardValue = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-2xl font-bold text-foreground", className)}
      {...props}
    />
  )
})
StatCardValue.displayName = "StatCardValue"

export { StatCard, StatCardIcon, StatCardLabel, StatCardValue }
