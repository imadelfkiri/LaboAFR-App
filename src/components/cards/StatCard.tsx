// components/cards/StatCard.tsx
import { ReactNode } from "react"

export function StatCard({
  label, value, icon: Icon,
}: { label: string; value: ReactNode; icon?: React.ElementType }) {
  return (
    <div className="stat-card">
      <h3 className="text-muted-foreground">{label}</h3>
      <p className="text-primary">{value}</p>
    </div>
  )
}
