// components/actions/ExportButton.tsx
import { FileDown, ChevronDown, FileText, FileJson } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ExportButton({ onPdfExport, onWordExport }: { onPdfExport: () => void; onWordExport: () => void; }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 rounded-xl">
          <FileDown className="w-4 h-4 mr-2" />
          Exporter
          <ChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={onPdfExport}>
            <FileText className="w-4 h-4 mr-2" />
            <span>Exporter en PDF</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onWordExport}>
            <FileJson className="w-4 h-4 mr-2" />
            <span>Exporter en Word</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
