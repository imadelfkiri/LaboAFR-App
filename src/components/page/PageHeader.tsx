// components/page/PageHeader.tsx
import { ReactNode } from "react"

export function PageHeader({
  title,
  subtitle,
  actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-neutral-300/80">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
