// components/cards/StatCard.tsx
import { ReactNode } from "react"
export function StatCard({
  label, value, hint, icon,
}: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft hover:shadow-ring transition-shadow border-l-4 border-primary">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon ? <div className="opacity-70">{icon}</div> : null}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}
