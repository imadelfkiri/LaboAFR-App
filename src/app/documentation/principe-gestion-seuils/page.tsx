"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SlidersHorizontal } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import Link from 'next/link';

export default function PrincipeGestionSeuilsPage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement de la Gestion des Seuils", page_width / 2, yPos, { align: "center" });
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Document généré le ${date}`, page_width / 2, yPos, { align: "center" });
    yPos += 15;
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Introduction", margin, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const introText = [
      "La page \"Gestion des Seuils\" est une section réservée aux administrateurs qui permet de personnaliser les seuils de qualité et de performance pour l'ensemble de l'application. Elle est le centre de contrôle pour définir ce qui est considéré comme \"conforme\" (vert), \"à surveiller\" (jaune) ou \"critique\" (rouge).",
      "L'objectif est de permettre à chaque usine d'adapter le comportement visuel de l'application à ses propres standards de production, ses objectifs et les caractéristiques de ses matières premières."
    ];
    for (const text of introText) {
        const lines = doc.splitTextToSize(text, page_width - margin * 2);
        for (const line of lines) {
            doc.text(line, margin, yPos);
            yPos += 6;
        }
        yPos += 4;
    }
    yPos += 6;
    
    const sections = [
        {
            title: "1. Les Différentes Sections de Seuils",
            content: "La page est divisée en trois catégories principales, correspondant aux grands modules de l'application.",
            points: [
                "Indicateurs Clés : Permet de définir les seuils pour le Taux de Substitution (TSR) et la Consommation Calorifique (CC) affichés sur la page \"Indicateurs\" et le \"Tableau de Bord\".",
                "Indicateurs du Mélange : Configure les couleurs pour les indicateurs du mélange de combustibles (PCI, Chlore, Cendres, Humidité, Taux de pneus) visibles sur les pages \"Calcul de Mélange\" et le \"Tableau de Bord\".",
                "Impact sur le Clinker (Δ) : Définit les seuils pour les variations (delta) des modules du clinker (LSF, C3S, MS, etc.) affichées sur la page \"Calcul d'Impact\" et le \"Tableau de Bord\"."
            ]
        },
        {
            title: "2. Comprendre la Logique des Seuils",
            points: [
                 "Seuils 'Min' et 'Max' : La logique de couleur est basée sur des seuils minimum et maximum. Par exemple, pour le PCI, vous pouvez définir une plage \"verte\" (optimale), une plage \"jaune\" (acceptable mais à surveiller) et tout ce qui est en dehors sera \"rouge\" (critique).",
                 "Seuils 'Vert Max' et 'Jaune Max' : Pour les indicateurs où une valeur plus basse est meilleure (ex: Chlore, Cendres), vous définissez le seuil maximum pour rester dans le vert, puis un seuil maximum pour la zone jaune. Au-delà, l'indicateur passe au rouge.",
                 "Seuils 'Vert Min' et 'Jaune Min' : Pour les indicateurs où une valeur plus haute est meilleure (ex: TSR, Δ C3S), vous définissez le seuil minimum pour être dans le vert, et un seuil minimum pour la zone jaune. En dessous, l'indicateur passe au rouge."
            ]
        },
        {
            title: "3. Impact sur l'Application",
            content: "Modifier un seuil ici a un impact immédiat et global sur l'interface utilisateur de toute l'application :",
            points: [
                 "Les cartes d'indicateurs dans \"Calcul de Mélange\" et sur le \"Tableau de Bord\" changeront de couleur instantanément pour refléter les nouveaux seuils.",
                 "Les jauges de performance de la page \"Indicateurs\" s'ajusteront pour montrer si les KPIs actuels sont dans les nouvelles cibles.",
                 "La carte \"Impact sur le Clinker\" sur le \"Tableau de Bord\" utilisera les nouvelles règles pour évaluer les variations."
            ]
        }
    ];

    for (const section of sections) {
        if (yPos > 250) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(section.title, margin, yPos);
        yPos += 7;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        if(section.content) {
            const contentLines = doc.splitTextToSize(section.content, page_width - margin * 2);
            for (const line of contentLines) {
                doc.text(line, margin, yPos);
                yPos += 6;
            }
            yPos += 4;
        }
        
        if(section.points) {
            for (const point of section.points) {
                if (yPos > 270) { doc.addPage(); yPos = 20; }
                const pointLines = doc.splitTextToSize(point, page_width - margin * 2 - 10);
                doc.text("•", margin + 5, yPos);
                for(const line of pointLines) {
                    doc.text(line, margin + 10, yPos);
                    yPos += 6;
                }
                yPos += 3;
            }
        }
        yPos += 8;
    }

    doc.save(`Principe_Gestion_Seuils_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Fonctionnement de la Gestion des Seuils", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page \"Gestion des Seuils\" est une section réservée aux administrateurs qui permet de personnaliser les seuils de qualité et de performance pour l'ensemble de l'application. Elle est le centre de contrôle pour définir ce qui est considéré comme \"conforme\" (vert), \"à surveiller\" (jaune) ou \"critique\" (rouge)."),
        new Paragraph("L'objectif est de permettre à chaque usine d'adapter le comportement visuel de l'application à ses propres standards de production, ses objectifs et les caractéristiques de ses matières premières."),

        new Paragraph({ text: "1. Les Différentes Sections de Seuils", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page est divisée en trois catégories principales, correspondant aux grands modules de l'application."),
        new Paragraph({ text: "Indicateurs Clés : Permet de définir les seuils pour le Taux de Substitution (TSR) et la Consommation Calorifique (CC) affichés sur la page \"Indicateurs\" et le \"Tableau de Bord\".", bullet: { level: 0 } }),
        new Paragraph({ text: "Indicateurs du Mélange : Configure les couleurs pour les indicateurs du mélange de combustibles (PCI, Chlore, Cendres, Humidité, Taux de pneus) visibles sur les pages \"Calcul de Mélange\" et le \"Tableau de Bord\".", bullet: { level: 0 } }),
        new Paragraph({ text: "Impact sur le Clinker (Δ) : Définit les seuils pour les variations (delta) des modules du clinker (LSF, C3S, MS, etc.) affichées sur la page \"Calcul d'Impact\" et le \"Tableau de Bord\".", bullet: { level: 0 } }),
        
        new Paragraph({ text: "2. Comprendre la Logique des Seuils", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph({ text: "Seuils 'Min' et 'Max' : La logique de couleur est basée sur des seuils minimum et maximum. Par exemple, pour le PCI, vous pouvez définir une plage \"verte\" (optimale), une plage \"jaune\" (acceptable mais à surveiller) et tout ce qui est en dehors sera \"rouge\" (critique).", bullet: { level: 0 } }),
        new Paragraph({ text: "Seuils 'Vert Max' et 'Jaune Max' : Pour les indicateurs où une valeur plus basse est meilleure (ex: Chlore, Cendres), vous définissez le seuil maximum pour rester dans le vert, puis un seuil maximum pour la zone jaune. Au-delà, l'indicateur passe au rouge.", bullet: { level: 0 } }),
        new Paragraph({ text: "Seuils 'Vert Min' et 'Jaune Min' : Pour les indicateurs où une valeur plus haute est meilleure (ex: TSR, Δ C3S), vous définissez le seuil minimum pour être dans le vert, et un seuil minimum pour la zone jaune. En dessous, l'indicateur passe au rouge.", bullet: { level: 0 } }),

        new Paragraph({ text: "3. Impact sur l'Application", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Modifier un seuil ici a un impact immédiat et global sur l'interface utilisateur de toute l'application :"),
        new Paragraph({ text: "Les cartes d'indicateurs dans \"Calcul de Mélange\" et sur le \"Tableau de Bord\" changeront de couleur instantanément pour refléter les nouveaux seuils.", bullet: { level: 0 } }),
        new Paragraph({ text: "Les jauges de performance de la page \"Indicateurs\" s'ajusteront pour montrer si les KPIs actuels sont dans les nouvelles cibles.", bullet: { level: 0 } }),
        new Paragraph({ text: "La carte \"Impact sur le Clinker\" sur le \"Tableau de Bord\" utilisera les nouvelles règles pour évaluer les variations.", bullet: { level: 0 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Gestion_Seuils_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <SlidersHorizontal className="h-8 w-8 text-primary" />
          Fonctionnement de la Gestion des Seuils
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique comment les administrateurs peuvent configurer les seuils de qualité qui affectent les alertes visuelles dans l'application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Gestion des Seuils" est une section réservée aux administrateurs qui permet de personnaliser les seuils de qualité et de performance pour l'ensemble de l'application. Elle est le centre de contrôle pour définir ce qui est considéré comme "conforme" (vert), "à surveiller" (jaune) ou "critique" (rouge).
          </p>
          <p>
            L'objectif est de permettre à chaque usine d'adapter le comportement visuel de l'application à ses propres standards de production, ses objectifs et les caractéristiques de ses matières premières.
          </p>
          
          <h2>1. Les Différentes Sections de Seuils</h2>
          <p>
            La page est divisée en trois catégories principales, correspondant aux grands modules de l'application.
          </p>
          <ul>
            <li><strong>Indicateurs Clés :</strong> Permet de définir les seuils pour le Taux de Substitution (TSR) et la Consommation Calorifique (CC) affichés sur la page <Link href="/indicateurs">Indicateurs</Link> et le <Link href="/">Tableau de Bord</Link>.</li>
            <li><strong>Indicateurs du Mélange :</strong> Configure les couleurs pour les indicateurs du mélange de combustibles (PCI, Chlore, Cendres, Humidité, Taux de pneus) visibles sur les pages <Link href="/calcul-melange">Calcul de Mélange</Link> et le <Link href="/">Tableau de Bord</Link>.</li>
            <li><strong>Impact sur le Clinker (Δ) :</strong> Définit les seuils pour les variations (delta) des modules du clinker (LSF, C3S, MS, etc.) affichées sur la page <Link href="/calcul-impact">Calcul d'Impact</Link> et le <Link href="/">Tableau de Bord</Link>.</li>
          </ul>

          <h2>2. Comprendre la Logique des Seuils</h2>
          <ul>
            <li><strong>Seuils 'Min' et 'Max' :</strong> La logique de couleur est basée sur des seuils minimum et maximum. Par exemple, pour le PCI, vous pouvez définir une plage "verte" (optimale), une plage "jaune" (acceptable mais à surveiller) et tout ce qui est en dehors sera "rouge" (critique).</li>
            <li><strong>Seuils 'Vert Max' et 'Jaune Max' :</strong> Pour les indicateurs où une valeur plus basse est meilleure (ex: Chlore, Cendres), vous définissez le seuil maximum pour rester dans le vert, puis un seuil maximum pour la zone jaune. Au-delà, l'indicateur passe au rouge.</li>
            <li><strong>Seuils 'Vert Min' et 'Jaune Min' :</strong> Pour les indicateurs où une valeur plus haute est meilleure (ex: TSR, Δ C3S), vous définissez le seuil minimum pour être dans le vert, et un seuil minimum pour la zone jaune. En dessous, l'indicateur passe au rouge.</li>
          </ul>

          <h2>3. Impact sur l'Application</h2>
          <p>
            Modifier un seuil ici a un impact immédiat et global sur l'interface utilisateur de toute l'application :
          </p>
          <ul>
            <li>Les cartes d'indicateurs dans "Calcul de Mélange" et sur le "Tableau de Bord" changeront de couleur instantanément pour refléter les nouveaux seuils.</li>
            <li>Les jauges de performance de la page "Indicateurs" s'ajusteront pour montrer si les KPIs actuels sont dans les nouvelles cibles.</li>
            <li>La carte "Impact sur le Clinker" sur le "Tableau de Bord" utilisera les nouvelles règles pour évaluer les variations.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
