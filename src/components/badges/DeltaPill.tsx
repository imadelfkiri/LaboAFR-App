
// components/badges/DeltaPill.tsx
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function DeltaPill({ 
  delta,
  color,
  icon: Icon
}: { 
  delta: number,
  color: "positive" | "danger" | "warning" | "neutral",
  icon: LucideIcon
}) {
  const colorClasses = {
    positive: "bg-green-500/20 text-green-300 ring-green-500/30",
    danger: "bg-red-500/20 text-red-300 ring-red-500/30",
    warning: "bg-yellow-500/20 text-yellow-300 ring-yellow-500/30",
    neutral: "bg-neutral-700/30 text-neutral-300 ring-neutral-600/20"
  };

  const sign = delta > 0 ? "+" : ""

  return (
    <span className={cn(
      `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ring-1 ring-inset`,
      colorClasses[color]
    )}>
      <Icon className="h-3.5 w-3.5" />
      {sign}{delta.toFixed(2)}
    </span>
  )
}
