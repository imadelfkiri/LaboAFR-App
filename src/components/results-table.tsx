
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  isValid,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  subMonths,
  endOfMonth,
  subWeeks,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarIcon,
  XCircle,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { getSpecifications, SPEC_MAP, getFuelSupplierMap } from "@/lib/data";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MultiSelect } from "@/components/ui/multi-select";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface Result {
  id: string;
  date_arrivage: { seconds: number; nanoseconds: number } | string;
  type_combustible: string;
  fournisseur: string;
  h2o: number;
  cendres: number | null;
  chlore: number | null;
  pci_brut: number;
  pcs: number;
  poids_godet: number | null;
  remarques: string;
}

interface AggregatedResult {
  type_combustible: string;
  fournisseur: string;
  pci_brut: number | null;
  h2o: number | null;
  chlore: number | null;
  cendres: number | null;
  poids_godet: number | null;
  count: number;
  alerts: {
    text: string;
    isConform: boolean;
    details: {
      pci: boolean;
      h2o: boolean;
      chlore: boolean;
      cendres: boolean;
    };
  };
}

// Étendre jsPDF pour autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export function ResultsTable() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [fournisseurFilter, setFournisseurFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<DateRange | undefined>();
  const [resultToDelete, setResultToDelete] = useState<string | null>(null);

  const [fuelSupplierMap, setFuelSupplierMap] = useState<Record<string, string[]>>({});
  const [availableFournisseurs, setAvailableFournisseurs] = useState<string[]>([]);

  const { toast } = useToast();

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      // These ensure SPEC_MAP is populated and we have the latest supplier map
      await getSpecifications(); 
      const map = await getFuelSupplierMap();
      setFuelSupplierMap(map);

      const q = query(collection(db, "resultats"), orderBy("date_arrivage", "desc"));
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const resultsData: Result[] = [];
          querySnapshot.forEach((d) => {
            resultsData.push({ id: d.id, ...(d.data() as any) } as Result);
          });
          setResults(resultsData);
          setLoading(false);
        },
        (error) => {
          console.error("Erreur de lecture des résultats:", error);
          toast({
            variant: "destructive",
            title: "Erreur de lecture",
            description: "Impossible de charger l'historique des résultats.",
          });
          setLoading(false);
        }
      );
      return unsubscribe;
    } catch (error) {
      console.error("Erreur lors de la récupération des données de base :", error);
      toast({
        variant: "destructive",
        title: "Erreur de données",
        description: "Impossible de charger les données de configuration.",
      });
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    fetchInitialData().then((unsub) => {
      if (unsub) unsubscribe = unsub;
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchInitialData]);

  const { uniqueFuelTypes, allUniqueFournisseurs } = useMemo(() => {
    const fuelTypes = [...new Set(results.map((r) => r.type_combustible))].sort();
    const fournisseurs = [...new Set(results.map((r) => r.fournisseur))].sort();
    return { uniqueFuelTypes: fuelTypes, allUniqueFournisseurs: fournisseurs };
  }, [results]);

  useEffect(() => {
    if (typeFilter.length > 0) {
      const newAvailable = typeFilter.flatMap((type) => fuelSupplierMap[type] || []);
      setAvailableFournisseurs([...new Set(newAvailable)].sort());
      setFournisseurFilter((current) => current.filter((f) => newAvailable.includes(f)));
    } else {
      setAvailableFournisseurs(allUniqueFournisseurs);
    }
  }, [typeFilter, fuelSupplierMap, allUniqueFournisseurs]);

  const normalizeDate = (date: { seconds: number; nanoseconds: number } | string): Date | null => {
    if (typeof date === "string") {
      const parsed = parseISO(date);
      return isValid(parsed) ? parsed : null;
    }
    if (date && typeof date.seconds === "number") {
      return new Timestamp(date.seconds, date.nanoseconds).toDate();
    }
    return null;
  };

  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      if (!result.date_arrivage) return false;
      const dateArrivage = normalizeDate(result.date_arrivage);
      if (!dateArrivage || !isValid(dateArrivage)) return false;

      const typeMatch = typeFilter.length === 0 || typeFilter.includes(result.type_combustible);
      const fournisseurMatch =
        fournisseurFilter.length === 0 || fournisseurFilter.includes(result.fournisseur);
      const dateMatch =
        !dateFilter ||
        ((!dateFilter.from || dateArrivage >= startOfDay(dateFilter.from)) &&
          (!dateFilter.to || dateArrivage <= endOfDay(dateFilter.to)));

      return typeMatch && fournisseurMatch && dateMatch;
    });
  }, [results, typeFilter, fournisseurFilter, dateFilter]);

  const calculateAverage = (arr: Result[], field: keyof Result): number | null => {
    const valid = arr.map((r) => r[field]).filter((v) => typeof v === "number") as number[];
    if (!valid.length) return null;
    const sum = valid.reduce((acc, v) => acc + v, 0);
    return sum / valid.length;
  };

  function formatDate(
    date: { seconds: number; nanoseconds: number } | string,
    formatStr: string = "dd/MM/yyyy"
  ): string {
    const parsedDate = normalizeDate(date);
    if (!parsedDate || !isValid(parsedDate)) return "Date inconnue";
    return format(parsedDate, formatStr, { locale: fr });
  }

  const resetFilters = () => {
    setTypeFilter([]);
    setFournisseurFilter([]);
    setDateFilter(undefined);
  };

  const handleDelete = async () => {
    if (!resultToDelete) return;
    try {
      await deleteDoc(doc(db, "resultats", resultToDelete));
      toast({ title: "Succès", description: "L'enregistrement a été supprimé." });
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "La suppression a échoué. Veuillez réessayer.",
      });
    } finally {
      setResultToDelete(null);
    }
  };

  const formatNumber = (num: number | null | undefined, fractionDigits: number = 0) => {
    if (num === null || num === undefined || Number.isNaN(num)) return "";
    return num
      .toLocaleString("fr-FR", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
        useGrouping: false,
      })
      .replace(".", ",");
  };

  const exportToExcel = (data: Result[], reportType: "Filtré") => {
    if (!data || data.length === 0) {
      toast({
        variant: "destructive",
        title: "Aucune donnée",
        description: "Il n'y a aucune donnée à exporter.",
      });
      return;
    }

    const reportDate = new Date();
    const formattedDate = format(reportDate, "dd/MM/yyyy");

    const titleText = `Rapport ${reportType} du ${formattedDate} analyses des AF`;
    const subtitleText = "Suivi des combustibles solides non dangereux";
    const filename = `Filtre_AFR_Report_${format(reportDate, "yyyy-MM-dd")}.xlsx`;

    const headers = [
      "Date",
      "Type Combustible",
      "Fournisseur",
      "PCS (kcal/kg)",
      "PCI sur Brut (kcal/kg)",
      "% H2O",
      "% Cl-",
      "% Cendres",
      "Poids Godet (t)",
      "Alertes",
      "Remarques",
    ];

    const border = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    } as const;
    const titleStyle = {
      font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "002060" } },
      border,
    } as const;
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "3F51B5" } },
      border,
    } as const;

    const dataStyleBase = { border, alignment: { vertical: "center" }, fill: { fgColor: { rgb: "F0F8FF" } } } as const;
    const dataStyleCenter = { ...dataStyleBase, alignment: { ...dataStyleBase.alignment, horizontal: "center" } } as const;
    const dataStyleLeft = { ...dataStyleBase, alignment: { ...dataStyleBase.alignment, horizontal: "left", wrapText: true } } as const;

    const ws_data: any[][] = [];
    ws_data.push(Array(headers.length).fill({ v: titleText, s: titleStyle }));
    ws_data.push(Array(headers.length).fill({ v: subtitleText, s: titleStyle }));
    ws_data.push([]);
    ws_data.push(headers.map((h) => ({ v: h, s: headerStyle })));

    const cleanAlertText = (text: string) => (text.endsWith(" / ") ? text.slice(0, -3) : text);

    data.forEach((result) => {
      const alert = generateAlerts(result);
      const row = [
        { v: formatDate(result.date_arrivage, "dd/MM/yyyy"), s: dataStyleCenter, t: "s" },
        { v: result.type_combustible, s: dataStyleLeft, t: "s" },
        { v: result.fournisseur, s: dataStyleLeft, t: "s" },
        { v: result.pcs, s: dataStyleCenter, t: "n" },
        { v: result.pci_brut, s: dataStyleCenter, t: "n" },
        { v: result.h2o, s: dataStyleCenter, t: "n" },
        { v: result.chlore ?? "N/A", s: dataStyleCenter, t: result.chlore === null ? "s" : "n" },
        { v: result.cendres ?? "N/A", s: dataStyleCenter, t: result.cendres === null ? "s" : "n" },
        { v: result.poids_godet ?? "N/A", s: dataStyleCenter, t: result.poids_godet === null ? "s" : "n" },
        { v: cleanAlertText(alert.text), s: dataStyleLeft, t: "s" },
        { v: result.remarques || "", s: dataStyleLeft, t: "s" },
      ];
      ws_data.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(ws_data, { cellStyles: true } as any);
    (ws as any)["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    ];

    const colWidths = [
      { wch: 12 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 22 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
      { wch: 35 },
      { wch: 40 },
    ];
    (ws as any)["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapport AFR");
    XLSX.writeFile(wb, filename, { bookType: "xlsx", type: "binary" });
  };

  const getSpecValueColor = (result: Result | AggregatedResult, field: keyof Result | keyof AggregatedResult) => {
    const spec = SPEC_MAP.get(`${result.type_combustible}|${result.fournisseur}`);
    if (!spec) return "text-gray-500";

    const value = (result as any)[field];
    if (typeof value !== "number") return "text-gray-500";

    let isConform = true;
    switch (field) {
      case "pci_brut":
        if (spec.PCI_min != null && value < spec.PCI_min) isConform = false;
        break;
      case "h2o":
        if (spec.H2O_max != null && value > spec.H2O_max) isConform = false;
        break;
      case "chlore":
        if (spec.Cl_max != null && value > spec.Cl_max) isConform = false;
        break;
      case "cendres":
        if (spec.Cendres_max != null && value > spec.Cendres_max) isConform = false;
        break;
      default:
        return "text-foreground";
    }
    return isConform ? "text-foreground" : "text-red-600";
  };

  const generateAlerts = (result: Result | AggregatedResult, checkCendres: boolean = true) => {
    const spec = SPEC_MAP.get(`${result.type_combustible}|${result.fournisseur}`);
    if (!spec) {
      return {
        text: "Spécification non définie",
        color: "text-gray-500",
        isConform: true,
        details: { pci: true, h2o: true, chlore: true, cendres: true },
      } as const;
    }

    const alerts: string[] = [];
    const alertDetails = { pci: true, h2o: true, chlore: true, cendres: true };

    if (spec.PCI_min != null && (result as any).pci_brut != null && (result as any).pci_brut < spec.PCI_min) {
      alerts.push("PCI bas");
      alertDetails.pci = false;
    }
    if (spec.H2O_max != null && (result as any).h2o != null && (result as any).h2o > spec.H2O_max) {
      alerts.push("H₂O élevé");
      alertDetails.h2o = false;
    }
    if ((result as any).chlore != null && spec.Cl_max != null && (result as any).chlore > spec.Cl_max) {
      alerts.push("Cl- élevé");
      alertDetails.chlore = false;
    }
    if (
      checkCendres &&
      (result as any).cendres != null &&
      spec.Cendres_max != null &&
      (result as any).cendres > spec.Cendres_max
    ) {
      alerts.push("Cendres élevées");
      alertDetails.cendres = false;
    }

    if (alerts.length === 0) {
      return { text: "Conforme", color: "text-green-600", isConform: true, details: alertDetails } as const;
    }

    return { text: alerts.join(" / "), color: "text-red-600", isConform: false, details: alertDetails } as const;
  };

  const aggregateResults = (data: Result[], checkCendres: boolean = false): AggregatedResult[] => {
    const grouped = new Map<string, { [K in keyof Omit<
      Result,
      "id" | "date_arrivage" | "type_combustible" | "fournisseur" | "remarques"
    >]: (number | null)[] } & { count: number }>();

    data.forEach((r) => {
      const key = `${r.type_combustible}|${r.fournisseur}`;
      if (!grouped.has(key)) {
        grouped.set(key, { pci_brut: [], h2o: [], chlore: [], cendres: [], pcs: [], poids_godet: [], count: 0 } as any);
      }
      const group = grouped.get(key)!;
      group.count++;
      ["pci_brut", "h2o", "chlore", "cendres", "pcs", "poids_godet"].forEach((metric) => {
        const value = (r as any)[metric];
        (group as any)[metric].push(typeof value === "number" ? value : null);
      });
    });

    const aggregated: AggregatedResult[] = [];
    grouped.forEach((value, key) => {
      const [type_combustible, fournisseur] = key.split("|");
      const avg = (arr: (number | null)[]) => {
        const validNums = arr.filter((n): n is number => typeof n === "number");
        return validNums.length > 0 ? validNums.reduce((a, b) => a + b, 0) / validNums.length : null;
      };

      const mockResult: AggregatedResult = {
        type_combustible,
        fournisseur,
        pci_brut: avg(value.pci_brut),
        h2o: avg(value.h2o),
        chlore: avg(value.chlore),
        cendres: avg(value.cendres),
        poids_godet: avg(value.poids_godet),
        count: value.count,
        alerts: { text: "", isConform: false, details: { pci: true, h2o: true, chlore: true, cendres: true } },
      };

      const alerts = generateAlerts(mockResult, checkCendres);
      aggregated.push({ ...mockResult, alerts });
    });

    return aggregated.sort(
      (a, b) =>
        a.type_combustible.localeCompare(b.type_combustible) ||
        a.fournisseur.localeCompare(b.fournisseur)
    );
  };

  const createStyledCell = (
    value: number | null,
    isConform: boolean,
    formatOptions: Intl.NumberFormatOptions = {}
  ) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return { content: "", styles: {} };
    }

    const styles: { textColor?: string | [number, number, number] } = {};
    if (isConform === false) styles.textColor = "#FF0000"; // rouge

    const content = value
      .toLocaleString("fr-FR", { useGrouping: false, ...formatOptions })
      .replace(".", ",");

    return { content, styles };
  };

  const createAlertCell = (isConform: boolean, alertText: string) => {
    const styles: { textColor?: string | [number, number, number] } = {};
    if (isConform) styles.textColor = [0, 100, 0];
    else styles.textColor = [255, 0, 0];
    return { content: alertText, styles };
  };

  const generatePdf = (
    data: any[],
    title: string,
    subtitle: string,
    columns: any[],
    orientation: "portrait" | "landscape",
    filename: string
  ) => {
    if (data.length === 0) {
      toast({ variant: "destructive", title: "Aucune donnée", description: "Il n'y a pas de données à exporter pour cette période." });
      return;
    }

    const doc = new jsPDF({ orientation });
    const generationDate = format(new Date(), "dd/MM/yyyy HH:mm:ss");
    const pageHeight = (doc as any).internal.pageSize.getHeight();
    const pageWidth = (doc as any).internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(title, pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, pageWidth / 2, 22, { align: "center" });

    const head = [columns.map((c) => c.header)];
    const body = data.map((row) =>
      columns.map((col) => {
        const cell = row[col.dataKey];
        if (cell && typeof cell === "object" && "content" in cell) return cell.content;
        return cell;
      })
    );

    (doc as any).autoTable({
      head,
      body,
      startY: 35,
      theme: "grid",
      headStyles: { fillColor: [63, 81, 181], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 248, 255] },
      styles: { textColor: [0, 0, 0], halign: "center", valign: "middle" },
      columnStyles: { 0: { halign: "left" }, 1: { halign: "left" }, [columns.length - 1]: { halign: "left" } },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body") {
          const rowData = data[hookData.row.index];
          const colKey = columns[hookData.column.index].dataKey;
          const cellData = rowData[colKey];
          if (cellData && typeof cellData === "object" && cellData.styles) {
            Object.assign(hookData.cell.styles, cellData.styles);
          }
        }
      },
      didDrawPage: (d: any) => {
        doc.setFontSize(8);
        doc.text(
          `Généré le: ${generationDate} - Page ${d.pageNumber} sur ${(doc as any).internal.pages.length - 1}`,
          d.settings.margin.left,
          pageHeight - 10
        );
      },
    });

    doc.save(filename);
  };

  const exportToPdfDaily = () => {
    const today = new Date();
    const yesterday = subDays(today, 1);

    const dailyData = results
      .filter((r) => {
        const d = normalizeDate(r.date_arrivage);
        if (!d || !isValid(d)) return false;
        const dateOnly = startOfDay(d);
        return (
          dateOnly.getTime() === startOfDay(today).getTime() ||
          dateOnly.getTime() === startOfDay(yesterday).getTime()
        );
      })
      .sort((a, b) => (normalizeDate(b.date_arrivage)!.getTime() - normalizeDate(a.date_arrivage)!.getTime()));

    const aggregated = aggregateResults(dailyData, false);

    const columns = [
      { header: "Type Combustible", dataKey: "type" },
      { header: "Fournisseur", dataKey: "fournisseur" },
      { header: "PCI sur Brut", dataKey: "pci" },
      { header: "% H2O", dataKey: "h2o" },
      { header: "% Cl-", dataKey: "cl" },
      { header: "Alertes", dataKey: "alerts" },
    ];

    const body = aggregated.map((r) => ({
      type: r.type_combustible,
      fournisseur: r.fournisseur,
      pci: createStyledCell(r.pci_brut, r.alerts.details.pci, { maximumFractionDigits: 0 }),
      h2o: createStyledCell(r.h2o, r.alerts.details.h2o, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      cl: createStyledCell(r.chlore, r.alerts.details.chlore, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      alerts: createAlertCell(r.alerts.isConform, r.alerts.text),
    }));

    generatePdf(
      body,
      "Suivi des analyses des combustibles solides non dangereux",
      `Rapport journalier du ${format(today, "dd/MM/yyyy", { locale: fr })}`,
      columns,
      "landscape",
      `Rapport_Journalier_AFR_${format(today, "yyyy-MM-dd")}.pdf`
    );
  };

  const exportToPdfWeekly = () => {
    const today = new Date();
    const start = startOfWeek(today.getDay() === 1 ? subWeeks(today, 1) : today, { weekStartsOn: 1 });
    const end = endOfWeek(start, { weekStartsOn: 1 });

    const weeklyData = results
      .filter((r) => {
        const d = normalizeDate(r.date_arrivage);
        return d && isValid(d) && d >= start && d <= end;
      })
      .sort((a, b) => normalizeDate(b.date_arrivage)!.getTime() - normalizeDate(a.date_arrivage)!.getTime());

    const aggregated = aggregateResults(weeklyData, false);

    const columns = [
      { header: "Type Combustible", dataKey: "type" },
      { header: "Fournisseur", dataKey: "fournisseur" },
      { header: "PCI sur Brut", dataKey: "pci" },
      { header: "% H2O", dataKey: "h2o" },
      { header: "% Cl-", dataKey: "cl" },
      { header: "Alertes", dataKey: "alerts" },
    ];

    const body = aggregated.map((r) => ({
      type: r.type_combustible,
      fournisseur: r.fournisseur,
      pci: createStyledCell(r.pci_brut, r.alerts.details.pci, { maximumFractionDigits: 0 }),
      h2o: createStyledCell(r.h2o, r.alerts.details.h2o, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      cl: createStyledCell(r.chlore, r.alerts.details.chlore, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      alerts: createAlertCell(r.alerts.isConform, r.alerts.text),
    }));

    generatePdf(
      body,
      "Suivi des analyses des combustibles solides non dangereux",
      `Rapport hebdomadaire semaine du ${format(start, "dd MMMM yyyy", { locale: fr })}`,
      columns,
      "landscape",
      `Rapport_Hebdo_AFR_Semaine_du_${format(start, "yyyy-MM-dd")}.pdf`
    );
  };

  const exportToPdfMonthly = () => {
    const today = new Date();
    const start = startOfMonth(today);
    const end = endOfMonth(today);

    const monthlyData = results
      .filter((r) => {
        const d = normalizeDate(r.date_arrivage);
        return d && isValid(d) && d >= start && d <= end;
      })
      .sort((a, b) => normalizeDate(b.date_arrivage)!.getTime() - normalizeDate(a.date_arrivage)!.getTime());

    const aggregated = aggregateResults(monthlyData, true);

    const columns = [
      { header: "Type Combustible", dataKey: "type" },
      { header: "Fournisseur", dataKey: "fournisseur" },
      { header: "PCI sur Brut", dataKey: "pci" },
      { header: "% H2O", dataKey: "h2o" },
      { header: "% Cl-", dataKey: "cl" },
      { header: "% Cendres", dataKey: "cendres" },
      { header: "Alertes", dataKey: "alerts" },
    ];

    const body = aggregated.map((r) => ({
      type: r.type_combustible,
      fournisseur: r.fournisseur,
      pci: createStyledCell(r.pci_brut, r.alerts.details.pci, { maximumFractionDigits: 0 }),
      h2o: createStyledCell(r.h2o, r.alerts.details.h2o, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      cl: createStyledCell(r.chlore, r.alerts.details.chlore, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      cendres: createStyledCell(r.cendres, r.alerts.details.cendres, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      alerts: createAlertCell(r.alerts.isConform, r.alerts.text),
    }));

    generatePdf(
      body,
      "Suivi des analyses des combustibles solides non dangereux",
      `Rapport mensuel ${format(today, "MMMM yyyy", { locale: fr })}`,
      columns,
      "landscape",
      `Rapport_Mensuel_AFR_${format(today, "yyyy-MM")}.pdf`
    );
  };

  const exportToPdfPreviousMonth = () => {
    const today = new Date();
    const prevMonthDate = subMonths(today, 1);
    const start = startOfMonth(prevMonthDate);
    const end = endOfMonth(prevMonthDate);

    const monthlyData = results
      .filter((r) => {
        const d = normalizeDate(r.date_arrivage);
        return d && isValid(d) && d >= start && d <= end;
      })
      .sort((a, b) => normalizeDate(b.date_arrivage)!.getTime() - normalizeDate(a.date_arrivage)!.getTime());

    const aggregated = aggregateResults(monthlyData, true);

    const columns = [
      { header: "Type Combustible", dataKey: "type" },
      { header: "Fournisseur", dataKey: "fournisseur" },
      { header: "PCI sur Brut", dataKey: "pci" },
      { header: "% H2O", dataKey: "h2o" },
      { header: "% Cl-", dataKey: "cl" },
      { header: "% Cendres", dataKey: "cendres" },
      { header: "Alertes", dataKey: "alerts" },
    ];

    const body = aggregated.map((r) => ({
      type: r.type_combustible,
      fournisseur: r.fournisseur,
      pci: createStyledCell(r.pci_brut, r.alerts.details.pci, { maximumFractionDigits: 0 }),
      h2o: createStyledCell(r.h2o, r.alerts.details.h2o, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      cl: createStyledCell(r.chlore, r.alerts.details.chlore, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      cendres: createStyledCell(r.cendres, r.alerts.details.cendres, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      alerts: createAlertCell(r.alerts.isConform, r.alerts.text),
    }));

    generatePdf(
      body,
      "Suivi des analyses des combustibles solides non dangereux",
      `Rapport mensuel ${format(prevMonthDate, "MMMM yyyy", { locale: fr })}`,
      columns,
      "landscape",
      `Rapport_Mensuel_AFR_${format(prevMonthDate, "yyyy-MM")}.pdf`
    );
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4 lg:p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <AlertDialog onOpenChange={(open) => !open && setResultToDelete(null)}>
        <div className="flex flex-col gap-4 p-4 lg:p-6 h-full">
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-md px-3 py-2">
            <MultiSelect
              options={uniqueFuelTypes.map((f) => ({ label: f, value: f }))}
              selected={typeFilter}
              onChange={setTypeFilter}
              placeholder="Filtrer par type..."
              className="w-full sm:w-auto flex-1 min-w-[160px] bg-white"
            />
            <MultiSelect
              options={availableFournisseurs.map((f) => ({ label: f, value: f }))}
              selected={fournisseurFilter}
              onChange={setFournisseurFilter}
              placeholder="Filtrer par fournisseur..."
              className="w-full sm:w-auto flex-1 min-w-[160px] bg-white"
            />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    "w-full sm:w-auto flex-1 min-w-[210px] justify-start text-left font-normal bg-white",
                    !dateFilter && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilter?.from ? (
                    dateFilter.to ? (
                      <>
                        {format(dateFilter.from, "d MMM y", { locale: fr })} -{" "}
                        {format(dateFilter.to, "d MMM y", { locale: fr })}
                      </>
                    ) : (
                      format(dateFilter.from, "d MMM y", { locale: fr })
                    )
                  ) : (
                    <span>Filtrer par date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateFilter?.from}
                  selected={dateFilter}
                  onSelect={setDateFilter}
                  numberOfMonths={2}
                  locale={fr}
                />
              </PopoverContent>
            </Popover>

            <Button
              onClick={resetFilters}
              variant="ghost"
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-200 h-9 px-3"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Réinitialiser
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto bg-white">
                  <Download className="mr-2 h-4 w-4" />
                  <span>Exporter</span>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPdfDaily}>Rapport Journalier</DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPdfWeekly}>Rapport Hebdomadaire</DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPdfMonthly}>Rapport Mensuel (Mois en cours)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPdfPreviousMonth}>Rapport Mensuel (Mois précédent)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportToExcel(filteredResults, "Filtré")}>
                  Exporter la vue filtrée (Excel)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <ScrollArea className="flex-grow rounded-lg border">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[120px] px-4 sticky left-0 bg-muted/50">Date Arrivage</TableHead>
                  <TableHead className="px-4 sticky left-[120px] bg-muted/50">Type Combustible</TableHead>
                  <TableHead className="px-4">Fournisseur</TableHead>
                  <TableHead className="text-right text-primary font-bold px-4">PCI sur Brut</TableHead>
                  <TableHead className="text-right px-4">% H2O</TableHead>
                  <TableHead className="text-right px-4">% Cl-</TableHead>
                  <TableHead className="text-right px-4">% Cendres</TableHead>
                  <TableHead className="px-4 font-bold">Alertes</TableHead>
                  <TableHead className="px-4">Remarques</TableHead>
                  <TableHead className="w-[50px] text-right px-4 sticky right-0 bg-muted/50">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.length > 0 ? (
                  <>
                    {filteredResults.map((result) => {
                      const alert = generateAlerts(result);
                      return (
                        <TableRow key={result.id}>
                          <TableCell className="font-medium px-4 sticky left-0 bg-background">
                            {formatDate(result.date_arrivage)}
                          </TableCell>
                          <TableCell className="px-4 sticky left-[120px] bg-background">
                            {result.type_combustible}
                          </TableCell>
                          <TableCell className="px-4">{result.fournisseur}</TableCell>
                          <TableCell className={cn("font-bold text-right px-4", getSpecValueColor(result, "pci_brut"))}>
                            {formatNumber(result.pci_brut, 0)}
                          </TableCell>
                          <TableCell className={cn("text-right px-4 font-medium", getSpecValueColor(result, "h2o"))}>
                            {formatNumber(result.h2o, 1)}
                          </TableCell>
                          <TableCell className={cn("text-right px-4 font-medium", getSpecValueColor(result, "chlore"))}>
                            {formatNumber(result.chlore, 2)}
                          </TableCell>
                          <TableCell className={cn("text-right px-4 font-medium", getSpecValueColor(result, "cendres"))}>
                            {formatNumber(result.cendres, 1)}
                          </TableCell>
                          <TableCell className={cn("px-4 font-semibold", alert.color)}>
                            <div className="flex items-center gap-2">
                              {!alert.isConform ? (
                                <AlertTriangle className="h-4 w-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              <span>{alert.text}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[240px] truncate text-muted-foreground px-4">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{result.remarques}</span>
                              </TooltipTrigger>
                              {result.remarques && <TooltipContent>{result.remarques}</TooltipContent>}
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-right px-4 sticky right-0 bg-background">
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setResultToDelete(result.id)}>
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={3} className="px-4 sticky left-0 bg-muted/40">
                        Moyenne de la sélection
                      </TableCell>
                      <TableCell className="text-right text-primary px-4">
                        {formatNumber(calculateAverage(filteredResults, "pci_brut"), 0)}
                      </TableCell>
                      <TableCell className="text-right px-4">
                        {formatNumber(calculateAverage(filteredResults, "h2o"), 1)}
                      </TableCell>
                      <TableCell className="text-right px-4">
                        {formatNumber(calculateAverage(filteredResults, "chlore"), 2)}
                      </TableCell>
                      <TableCell className="text-right px-4">
                        {formatNumber(calculateAverage(filteredResults, "cendres"), 1)}
                      </TableCell>
                      <TableCell colSpan={3} className="sticky right-0 bg-muted/40" />
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                      Aucun résultat trouvé.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Le résultat sera définitivement supprimé de la base de données.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </div>
      </AlertDialog>
    </TooltipProvider>
  );
}

export default ResultsTable;
