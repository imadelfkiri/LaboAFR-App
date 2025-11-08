"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export default function PrincipeStatistiquesPage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement de la Page Statistiques", page_width / 2, yPos, { align: "center" });
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
        "La page \"Statistiques\" est un outil d'analyse visuelle puissant qui permet de suivre les tendances et de comparer les performances des combustibles sur des périodes données. Elle transforme les données brutes des analyses en graphiques interactifs.",
        "Son objectif est de permettre une analyse approfondie de la qualité des combustibles, d'identifier des tendances (saisonnalité, dégradation de la qualité d'un fournisseur) et de comparer les performances entre différentes années."
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
            title: "1. Le Panneau de Filtres",
            content: "Situé en haut, ce panneau vous permet d'affiner précisément les données qui seront affichées sur les graphiques.",
            points: [
                "Filtre par Type de Combustible : Permet de se concentrer sur un seul type de combustible (ex: Pneus, CSR) ou de tous les afficher.",
                "Filtre par Fournisseur : Permet de n'afficher que les analyses d'un fournisseur spécifique. Cette liste est mise à jour dynamiquement en fonction du combustible sélectionné.",
                "Filtre par Période : Un sélecteur de date vous permet de choisir une plage de dates (début et fin) pour l'analyse."
            ]
        },
        {
            title: "2. Les Graphiques d'Évolution",
            content: "Quatre graphiques principaux affichent l'évolution de la moyenne journalière des indicateurs clés pour la période et les filtres sélectionnés.",
            points: [
                 "PCI (kcal/kg) : Pouvoir Calorifique Inférieur.",
                 "H₂O (%) : Taux d'humidité.",
                 "Chlore (%) : Teneur en chlorures.",
                 "Cendres (%) : Teneur en cendres.",
                 "Logique de Calcul : Pour chaque jour de la période sélectionnée, l'application calcule la moyenne de toutes les analyses enregistrées ce jour-là (pour les combustibles et fournisseurs filtrés) et affiche ce point sur le graphique. Cela permet de lisser les variations et de dégager une tendance."
            ]
        },
        {
            title: "3. Le Graphique de Comparaison Annuelle",
            content: "Ce graphique offre une vue macroscopique pour comparer les performances entre l'année en cours et l'année précédente.",
            points: [
                "Indicateur Sélectionnable : Vous pouvez choisir l'indicateur à comparer (PCI, H₂O, Cendres, etc.) via un menu déroulant.",
                "Vue Année N vs Année N-1 : Le graphique affiche la moyenne mensuelle pour l'année en cours (barres bleues) et la compare à la moyenne globale de l'année précédente (barre violette). Une barre pour la moyenne de l'année en cours est également affichée (barre jaune).",
                "Objectif : Cet outil est très utile pour détecter des tendances saisonnières ou des changements de qualité d'une année sur l'autre."
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

    doc.save(`Principe_Page_Statistiques_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Fonctionnement de la Page Statistiques", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page \"Statistiques\" est un outil d'analyse visuelle puissant qui permet de suivre les tendances et de comparer les performances des combustibles sur des périodes données. Elle transforme les données brutes des analyses en graphiques interactifs."),
        new Paragraph("Son objectif est de permettre une analyse approfondie de la qualité des combustibles, d'identifier des tendances (saisonnalité, dégradation de la qualité d'un fournisseur) et de comparer les performances entre différentes années."),

        new Paragraph({ text: "1. Le Panneau de Filtres", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Situé en haut, ce panneau vous permet d'affiner précisément les données qui seront affichées sur les graphiques."),
        new Paragraph({ text: "Filtre par Type de Combustible : Permet de se concentrer sur un seul type de combustible (ex: Pneus, CSR) ou de tous les afficher.", bullet: { level: 0 } }),
        new Paragraph({ text: "Filtre par Fournisseur : Permet de n'afficher que les analyses d'un fournisseur spécifique. Cette liste est mise à jour dynamiquement en fonction du combustible sélectionné.", bullet: { level: 0 } }),
        new Paragraph({ text: "Filtre par Période : Un sélecteur de date vous permet de choisir une plage de dates (début et fin) pour l'analyse.", bullet: { level: 0 } }),

        new Paragraph({ text: "2. Les Graphiques d'Évolution", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Quatre graphiques principaux affichent l'évolution de la moyenne journalière des indicateurs clés pour la période et les filtres sélectionnés."),
        new Paragraph({ text: "PCI (kcal/kg) : Pouvoir Calorifique Inférieur.", bullet: { level: 0 } }),
        new Paragraph({ text: "H₂O (%) : Taux d'humidité.", bullet: { level: 0 } }),
        new Paragraph({ text: "Chlore (%) : Teneur en chlorures.", bullet: { level: 0 } }),
        new Paragraph({ text: "Cendres (%) : Teneur en cendres.", bullet: { level: 0 } }),
        new Paragraph({ text: "Logique de Calcul : Pour chaque jour de la période sélectionnée, l'application calcule la moyenne de toutes les analyses enregistrées ce jour-là (pour les combustibles et fournisseurs filtrés) et affiche ce point sur le graphique. Cela permet de lisser les variations et de dégager une tendance.", bullet: { level: 0 } }),
        
        new Paragraph({ text: "3. Le Graphique de Comparaison Annuelle", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Ce graphique offre une vue macroscopique pour comparer les performances entre l'année en cours et l'année précédente."),
        new Paragraph({ text: "Indicateur Sélectionnable : Vous pouvez choisir l'indicateur à comparer (PCI, H₂O, Cendres, etc.) via un menu déroulant.", bullet: { level: 0 } }),
        new Paragraph({ text: "Vue Année N vs Année N-1 : Le graphique affiche la moyenne mensuelle pour l'année en cours (barres bleues) et la compare à la moyenne globale de l'année précédente (barre violette). Une barre pour la moyenne de l'année en cours est également affichée (barre jaune).", bullet: { level: 0 } }),
        new Paragraph({ text: "Objectif : Cet outil est très utile pour détecter des tendances saisonnières ou des changements de qualité d'une année sur l'autre.", bullet: { level: 0 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Page_Statistiques_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <BarChart3 className="h-8 w-8 text-primary" />
          Fonctionnement de la Page Statistiques
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique comment visualiser les tendances des indicateurs de qualité des combustibles et comparer les performances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Statistiques" est un outil d'analyse visuelle puissant qui permet de suivre les tendances et de comparer les performances des combustibles sur des périodes données. Elle transforme les données brutes des analyses en graphiques interactifs.
          </p>
          <p>
            Son objectif est de permettre une analyse approfondie de la qualité des combustibles, d'identifier des tendances (saisonnalité, dégradation de la qualité d'un fournisseur) et de comparer les performances entre différentes années.
          </p>
          
          <h2>1. Le Panneau de Filtres</h2>
          <p>
            Situé en haut, ce panneau vous permet d'affiner précisément les données qui seront affichées sur les graphiques.
          </p>
          <ul>
            <li><strong>Filtre par Type de Combustible :</strong> Permet de se concentrer sur un seul type de combustible (ex: Pneus, CSR) ou de tous les afficher.</li>
            <li><strong>Filtre par Fournisseur :</strong> Permet de n'afficher que les analyses d'un fournisseur spécifique. Cette liste est mise à jour dynamiquement en fonction du combustible sélectionné.</li>
            <li><strong>Filtre par Période :</strong> Un sélecteur de date vous permet de choisir une plage de dates (début et fin) pour l'analyse.</li>
          </ul>

          <h2>2. Les Graphiques d'Évolution</h2>
          <p>
            Quatre graphiques principaux affichent l'évolution de la moyenne journalière des indicateurs clés pour la période et les filtres sélectionnés.
          </p>
          <ul>
            <li><strong>PCI (kcal/kg) :</strong> Pouvoir Calorifique Inférieur.</li>
            <li><strong>H₂O (%) :</strong> Taux d'humidité.</li>
            <li><strong>Chlore (%) :</strong> Teneur en chlorures.</li>
            <li><strong>Cendres (%) :</strong> Teneur en cendres.</li>
            <li><strong>Logique de Calcul :</strong> Pour chaque jour de la période sélectionnée, l'application calcule la moyenne de toutes les analyses enregistrées ce jour-là (pour les combustibles et fournisseurs filtrés) et affiche ce point sur le graphique. Cela permet de lisser les variations et de dégager une tendance.</li>
          </ul>

          <h2>3. Le Graphique de Comparaison Annuelle</h2>
          <p>
            Ce graphique offre une vue macroscopique pour comparer les performances entre l'année en cours et l'année précédente.
          </p>
          <ul>
              <li><strong>Indicateur Sélectionnable :</strong> Vous pouvez choisir l'indicateur à comparer (PCI, H₂O, Cendres, etc.) via un menu déroulant.</li>
              <li><strong>Vue Année N vs Année N-1 :</strong> Le graphique affiche la moyenne mensuelle pour l'année en cours (barres bleues) et la compare à la moyenne globale de l'année précédente (barre violette). Une barre pour la moyenne de l'année en cours est également affichée (barre jaune).</li>
              <li><strong>Objectif :</strong> Cet outil est très utile pour détecter des tendances saisonnières ou des changements de qualité d'une année sur l'autre.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
