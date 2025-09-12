// components/cards/StatCard.tsx
import { ReactNode } from "react"
export function StatCard({
  label, value, hint, icon,
}: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-brand-surface/60 border border-brand-line/60 p-4 shadow-soft hover:shadow-ring transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-300">{label}</span>
        {icon ? <div className="opacity-70">{icon}</div> : null}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-neutral-400">{hint}</div> : null}
    </div>
  )
}
