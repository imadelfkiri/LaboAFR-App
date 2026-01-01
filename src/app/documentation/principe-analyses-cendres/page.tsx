"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import Link from 'next/link';

export default function PrincipeAnalysesCendresPage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement de la Page Analyses Cendres", page_width / 2, yPos, { align: "center" });
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
      "La page \"Analyses des Cendres\" est un module essentiel qui permet de centraliser et de gérer l'analyse chimique des cendres produites par la combustion des combustibles alternatifs (AF).",
      "Son objectif principal est de constituer une base de données historique et fiable sur la composition des cendres. Cette composition est un facteur critique car elle influence directement la chimie du clinker, et donc sa qualité finale."
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
            title: "1. L'Interface de Gestion des Analyses",
            content: "La page est structurée pour permettre une saisie et une consultation efficaces des données.",
            points: [
                "Barre d'outils : Elle permet de filtrer les analyses par type de combustible, fournisseur ou période, mais aussi d'ajouter une nouvelle analyse, d'importer des données depuis un fichier Excel, ou d'exporter la sélection actuelle.",
                "Tableau des Analyses : Affiche toutes les données enregistrées. Chaque ligne représente une analyse de cendre à une date donnée, avec sa composition détaillée en oxydes (SiO₂, Al₂O₃, Fe₂O₃, etc.).",
                "Modules calculés : Les colonnes MS (Module Siliceux), A/F (Module Alumino-Ferrique) et LSF (Facteur de Saturation en Chaux) sont calculées automatiquement pour chaque analyse. Ces modules sont des indicateurs clés de la \"cuisabilité\" du matériau et de la qualité du clinker.",
                "Lignes de Moyennes : En bas du tableau, des lignes spéciales calculent et affichent la composition moyenne des cendres pour les grandes familles de combustibles (Pet coke, Grignons, AFs), vous donnant une vue d'ensemble rapide."
            ]
        },
        {
            title: "2. Relation avec les Autres Pages (Très Important)",
            content: "Cette page n'est pas isolée. Les données que vous y enregistrez sont cruciales pour le fonctionnement d'autres modules, en particulier la page \"Calcul d'Impact\".",
            points: [
                 "Entrée pour le Calcul d'Impact : Lorsque vous utilisez l'outil de \"Calcul d'Impact\", celui-ci a besoin de connaître la composition chimique des cendres qui seront ajoutées au cru. L'application va alors automatiquement chercher toutes les analyses de cendres pertinentes dans cette page, en calculer une \"cendre moyenne pondérée\" basée sur le mélange de combustibles actuel, et utiliser cette cendre moyenne comme un des intrants principaux de sa simulation.",
                 "Fiabilisation des simulations : En gardant cette base de données à jour, vous garantissez que les simulations d'impact sur le clinker sont basées sur les données les plus récentes et les plus précises possibles. Une analyse de cendre manquante ou erronée ici peut fausser les prédictions de la qualité du clinker.",
            ]
        },
        {
            title: "3. Flux de Travail Suggéré",
            points: [
                "Réception d'un combustible : Enregistrez son analyse de base (PCI, H₂O) via la page \"Calculateur PCI\".",
                "Analyse des cendres : Une fois que vous avez l'analyse chimique des cendres de ce combustible, venez sur cette page (\"Analyses Cendres\") pour l'enregistrer.",
                "Simulation d'impact : Vous pouvez maintenant aller sur la page \"Calcul d'Impact\" en sachant que votre simulation sera basée sur les dernières analyses de cendres disponibles."
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

    doc.save(`Principe_Page_Analyses_Cendres_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Fonctionnement de la Page Analyses Cendres", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page \"Analyses des Cendres\" est un module essentiel qui permet de centraliser et de gérer l'analyse chimique des cendres produites par la combustion des combustibles alternatifs (AF)."),
        new Paragraph("Son objectif principal est de constituer une base de données historique et fiable sur la composition des cendres. Cette composition est un facteur critique car elle influence directement la chimie du clinker, et donc sa qualité finale."),

        new Paragraph({ text: "1. L'Interface de Gestion des Analyses", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("L'interface est structurée pour permettre une saisie et une consultation efficaces des données."),
        new Paragraph({ text: "Barre d'outils : Elle permet de filtrer les analyses par type de combustible, fournisseur ou période, mais aussi d'ajouter une nouvelle analyse, d'importer des données depuis un fichier Excel, ou d'exporter la sélection actuelle.", bullet: { level: 0 } }),
        new Paragraph({ text: "Tableau des Analyses : Affiche toutes les données enregistrées. Chaque ligne représente une analyse de cendre à une date donnée, avec sa composition détaillée en oxydes (SiO₂, Al₂O₃, Fe₂O₃, etc.).", bullet: { level: 0 } }),
        new Paragraph({ text: "Modules calculés : Les colonnes MS (Module Siliceux), A/F (Module Alumino-Ferrique) et LSF (Facteur de Saturation en Chaux) sont calculées automatiquement pour chaque analyse. Ces modules sont des indicateurs clés de la \"cuisabilité\" du matériau et de la qualité du clinker.", bullet: { level: 0 } }),
        new Paragraph({ text: "Lignes de Moyennes : En bas du tableau, des lignes spéciales calculent et affichent la composition moyenne des cendres pour les grandes familles de combustibles (Pet coke, Grignons, AFs), vous donnant une vue d'ensemble rapide.", bullet: { level: 0 } }),
        
        new Paragraph({ text: "2. Relation avec les Autres Pages (Très Important)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Cette page n'est pas isolée. Les données que vous y enregistrez sont cruciales pour le fonctionnement d'autres modules, en particulier la page \"Calcul d'Impact\"."),
        new Paragraph({ text: "Entrée pour le Calcul d'Impact : Lorsque vous utilisez l'outil de \"Calcul d'Impact\", celui-ci a besoin de connaître la composition chimique des cendres qui seront ajoutées au cru. L'application va alors automatiquement chercher toutes les analyses de cendres pertinentes dans cette page, en calculer une \"cendre moyenne pondérée\" basée sur le mélange de combustibles actuel, et utiliser cette cendre moyenne comme un des intrants principaux de sa simulation.", bullet: { level: 0 } }),
        new Paragraph({ text: "Fiabilisation des simulations : En gardant cette base de données à jour, vous garantissez que les simulations d'impact sur le clinker sont basées sur les données les plus récentes et les plus précises possibles. Une analyse de cendre manquante ou erronée ici peut fausser les prédictions de la qualité du clinker.", bullet: { level: 0 } }),
        
        new Paragraph({ text: "3. Flux de Travail Suggéré", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph({ text: "Réception d'un combustible : Enregistrez son analyse de base (PCI, H₂O) via la page \"Calculateur PCI\".", bullet: { level: 0 } }),
        new Paragraph({ text: "Analyse des cendres : Une fois que vous avez l'analyse chimique des cendres de ce combustible, venez sur cette page (\"Analyses Cendres\") pour l'enregistrer.", bullet: { level: 0 } }),
        new Paragraph({ text: "Simulation d'impact : Vous pouvez maintenant aller sur la page \"Calcul d'Impact\" en sachant que votre simulation sera basée sur les dernières analyses de cendres disponibles.", bullet: { level: 0 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Page_Analyses_Cendres_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <ClipboardList className="h-8 w-8 text-primary" />
          Fonctionnement de la Page Analyses Cendres
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique comment gérer les analyses chimiques des cendres et leur importance pour la simulation d'impact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Analyses des Cendres" est un module essentiel qui permet de centraliser et de gérer l'analyse chimique des cendres produites par la combustion des combustibles alternatifs (AF).
          </p>
          <p>
            Son objectif principal est de constituer une base de données historique et fiable sur la composition des cendres. Cette composition est un facteur critique car elle influence directement la chimie du clinker, et donc sa qualité finale.
          </p>
          
          <h2>1. L'Interface de Gestion des Analyses</h2>
          <p>
            L'interface est structurée pour permettre une saisie et une consultation efficaces des données.
          </p>
          <ul>
            <li><strong>Barre d'outils :</strong> Elle permet de filtrer les analyses par type de combustible, fournisseur ou période, mais aussi d'ajouter une nouvelle analyse, d'importer des données depuis un fichier Excel, ou d'exporter la sélection actuelle.</li>
            <li><strong>Tableau des Analyses :</strong> Affiche toutes les données enregistrées. Chaque ligne représente une analyse de cendre à une date donnée, avec sa composition détaillée en oxydes (SiO₂, Al₂O₃, Fe₂O₃, etc.).</li>
            <li><strong>Modules calculés :</strong> Les colonnes MS (Module Siliceux), A/F (Module Alumino-Ferrique) et LSF (Facteur de Saturation en Chaux) sont calculées automatiquement pour chaque analyse. Ces modules sont des indicateurs clés de la "cuisabilité" du matériau et de la qualité du clinker.</li>
            <li><strong>Lignes de Moyennes :</strong> En bas du tableau, des lignes spéciales calculent et affichent la composition moyenne des cendres pour les grandes familles de combustibles (Pet coke, Grignons, AFs), vous donnant une vue d'ensemble rapide.</li>
          </ul>

          <h2>2. Relation avec les Autres Pages (Très Important)</h2>
          <p>
            Cette page n'est pas isolée. Les données que vous y enregistrez sont cruciales pour le fonctionnement d'autres modules, en particulier la page <strong>"Calcul d'Impact"</strong>.
          </p>
          <ul>
            <li><strong>Entrée pour le Calcul d'Impact :</strong> Lorsque vous utilisez l'outil de "Calcul d'Impact", celui-ci a besoin de connaître la composition chimique des cendres qui seront ajoutées au cru. L'application va alors automatiquement chercher toutes les analyses de cendres pertinentes dans cette page, en calculer une <strong>"cendre moyenne pondérée"</strong> basée sur le mélange de combustibles actuel, et utiliser cette cendre moyenne comme un des intrants principaux de sa simulation.</li>
            <li><strong>Fiabilisation des simulations :</strong> En gardant cette base de données à jour, vous garantissez que les simulations d'impact sur le clinker sont basées sur les données les plus récentes et les plus précises possibles. Une analyse de cendre manquante ou erronée ici peut fausser les prédictions de la qualité du clinker.</li>
          </ul>

          <h2>3. Flux de Travail Suggéré</h2>
          <ol>
              <li><strong>Réception d'un combustible :</strong> Enregistrez son analyse de base (PCI, H₂O) via la page <Link href="/calculateur">Calculateur PCI</Link>.</li>
              <li><strong>Analyse des cendres :</strong> Une fois que vous avez l'analyse chimique des cendres de ce combustible, venez sur cette page ("Analyses Cendres") pour l'enregistrer.</li>
              <li><strong>Simulation d'impact :</strong> Vous pouvez maintenant aller sur la page <Link href="/calcul-impact">Calcul d'Impact</Link> en sachant que votre simulation sera basée sur les dernières analyses de cendres disponibles.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
