/* ===== Toolbar sans recherche + 1 seul bouton “Période” (à coller tel quel) =====
   - Supprime la barre de recherche
   - Remplace les 2 champs dates par **un seul bouton** avec icône calendrier
   - Toutes les icônes/boutons sont alignés sur **une seule ligne**
*/
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar, Download, Upload, Plus, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export default function ToolbarAnalysesCendres({
  fuel="__ALL__", setFuel=()=>{},
  supplier="__ALL__", setSupplier=()=>{},
  fuels=[], suppliers=[],
  from="", setFrom=()=>{},
  to="", setTo=()=>{},
  onExport=(type: 'excel' | 'pdf') => {}, 
  onImport=()=>{}, 
  onAdd=()=>{},
  q="", setQ=()=>{},
}) {
  // libellé du bouton période
  const label = React.useMemo(() => {
    if (from && to) return `${from} → ${to}`
    if (from) return `du ${from}`
    if (to) return `jusqu'au ${to}`
    return "Période"
  }, [from, to])

  return (
    <div className="p-3 md:p-5">
    <Card className="rounded-2xl shadow-sm border border-brand-line/60 bg-brand-surface/60">
      <CardContent className="p-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center">
          {/* Filtres à gauche */}
          <div className="lg:col-span-3">
            <Select value={fuel} onValueChange={setFuel}>
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue placeholder="Combustible" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">Tous les combustibles</SelectItem>
                {fuels.map((f:string)=><SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="lg:col-span-3">
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue placeholder="Fournisseur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">Tous les fournisseurs</SelectItem>
                {suppliers.map((s:string)=><SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Bouton unique “Période” (ouvre un popover avec 2 dates) */}
          <div className="lg:col-span-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-9 rounded-xl justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  {label}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[280px] p-3 space-y-2">
                <div className="text-sm font-medium mb-1">Sélectionner une période</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" className="h-9" value={from} onChange={(e)=>setFrom(e.target.value)} aria-label="Du" />
                  <Input type="date" className="h-9" value={to} onChange={(e)=>setTo(e.target.value)} aria-label="Au" />
                </div>
                <div className="flex justify-between pt-1">
                  <Button variant="ghost" size="sm" onClick={()=>{ setFrom(""); setTo(""); }}>Réinitialiser</Button>
                  <PopoverClose asChild>
                    <Button size="sm">OK</Button>
                  </PopoverClose>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions à droite sur le même niveau */}
          <div className="lg:col-span-4 flex items-center justify-end gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 rounded-xl"><Download className="w-4 h-4 mr-1"/>Exporter <ChevronDown className="w-4 h-4 ml-1" /></Button>
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
        </div>
      </CardContent>
    </Card>
    </div>
  )
}

// Add PopoverClose to the imports
import { PopoverClose } from "@radix-ui/react-popover";
