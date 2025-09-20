// components/actions/ExportButton.tsx
import { FileDown } from "lucide-react"

export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl bg-brand-accent/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-inset ring-brand-accent/30 hover:bg-brand-accent/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
    >
      <FileDown className="h-4 w-4" />
      Exporter
    </button>
  )
}
