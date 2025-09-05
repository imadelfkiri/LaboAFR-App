/* ==== Toolbar avec icônes en haut + barre de recherche réduite (à coller tel quel) ==== */
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Download, Upload, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export default function ToolbarAnalysesCendres({
  q="", setQ=()=>{},
  fuel="__ALL__", setFuel=()=>{},
  supplier="__ALL__", setSupplier=()=>{},
  from="", setFrom=()=>{},
  to="", setTo=()=>{},
  fuels=[], suppliers=[],
  onExport=(type: 'excel' | 'pdf') => {}, 
  onImport=()=>{}, 
  onAdd=()=>{},
}) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-3 md:px-5 pt-2">
      <Card className="rounded-2xl shadow-sm border">
        <CardContent className="p-3 space-y-2">
          {/* Ligne 1 : icônes/actions en HAUT à droite */}
          <div className="flex items-center justify-end gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 rounded-xl"><Download className="w-4 h-4 mr-1"/>Exporter</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onExport('excel')}>Exporter en Excel</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('pdf')}>Exporter en PDF</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" className="h-9 rounded-xl" onClick={onImport}>
              <Upload className="w-4 h-4 mr-1" /> Importer
            </Button>
            <Button className="h-9 rounded-xl" onClick={onAdd}>
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>

          {/* Ligne 2 : recherche RÉDUITE + filtres alignés */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
            {/* Barre de recherche réduite */}
            <div className="lg:col-span-4">
              <Input
                className="h-9 rounded-xl w-full"
                placeholder="Rechercher…"
                value={q}
                onChange={(e)=>setQ(e.target.value)}
              />
            </div>

            {/* Combustible */}
            <div className="lg:col-span-3">
              <Select value={fuel} onValueChange={setFuel}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Combustible" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">Tous</SelectItem>
                  {fuels.map((f:string)=><SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Fournisseur */}
            <div className="lg:col-span-3">
              <Select value={supplier} onValueChange={setSupplier}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Fournisseur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">Tous</SelectItem>
                  {suppliers.map((s:string)=><SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="lg:col-span-1">
              <Input
                type="date"
                className="h-9 rounded-xl text-muted-foreground [color-scheme:light]"
                value={from}
                onChange={(e)=>setFrom(e.target.value)}
                placeholder="Du"
                title="Du"
              />
            </div>
            <div className="lg:col-span-1">
              <Input
                type="date"
                className="h-9 rounded-xl text-muted-foreground [color-scheme:light]"
                value={to}
                onChange={(e)=>setTo(e.target.value)}
                placeholder="Au"
                title="Au"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
