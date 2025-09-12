// components/badges/DeltaPill.tsx
export function DeltaPill({ delta }: { delta: number }) {
  const color =
    delta > 0.001 ? "bg-positive/15 text-positive ring-positive/20"
    : delta < -0.001 ? "bg-danger/15 text-danger ring-danger/20"
    : "bg-neutral-700/30 text-neutral-300 ring-neutral-600/20"
  const sign = delta > 0 ? "+" : ""
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ring-1 ring-inset ${color}`}>
      {sign}{delta.toFixed(2)}%
    </span>
  )
}
