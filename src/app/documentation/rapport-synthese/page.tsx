"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FilePieChart } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export default function PrincipeRapportSynthesePage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement du Rapport de Synthèse", page_width / 2, yPos, { align: "center" });
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
      "La page \"Rapport de Synthèse\" est un tableau de bord consolidé qui rassemble les informations les plus critiques de vos simulations. Elle a été conçue pour fournir une vue d'ensemble claire et immédiate, prête à être partagée, archivée ou discutée.",
      "Son objectif est de synthétiser en un seul endroit les résultats du \"Calcul de Mélange\" et du \"Calcul d'Impact\", vous offrant ainsi une vision complète de la situation actuelle, de la recette de combustible à son effet final sur le clinker."
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
            title: "1. Les Composants du Rapport",
            content: "Le rapport est divisé en plusieurs cartes logiques qui présentent les données de manière structurée.",
            points: [
                "Indicateurs du Mélange : Cette carte affiche les caractéristiques finales du mélange de combustibles (PCI, Chlore, Cendres, etc.) telles que définies dans la page \"Calcul de Mélange\". Les couleurs (vert, jaune, rouge) vous indiquent immédiatement la conformité par rapport aux seuils que vous avez définis.",
                "Impact sur le Clinker : Ce graphique à barres visualise le \"delta\" (la variation) des indicateurs clés du clinker (LSF, C3S, etc.) entre un clinker théorique (sans cendres) et le clinker calculé (avec les cendres du mélange). C'est un résumé visuel direct de la page \"Calcul d'Impact\".",
                "Composition (Godets) : Un tableau simple qui liste le nombre de godets pour chaque combustible utilisé dans la recette actuelle du mélange.",
                "Répartition du Mélange (% Poids) : Un graphique qui montre la part en pourcentage de chaque combustible dans le poids total du mélange, permettant de visualiser rapidement les contributeurs majoritaires."
            ]
        },
        {
            title: "2. Relation avec les Autres Pages (Le Cœur du Système)",
            content: "Cette page est la destination finale des données calculées dans d'autres modules. Elle ne génère pas de nouvelles informations mais les agrège de manière intelligente :",
            points: [
                 "Source des Données : Toutes les informations affichées proviennent de la dernière \"session de mélange\" enregistrée. Lorsque vous cliquez sur \"Enregistrer la Session\" dans la page \"Calcul de Mélange\", vous créez un instantané qui alimente ce rapport.",
                 "Lien avec le Calcul d'Impact : Le graphique d'impact se base sur le dernier calcul d'impact sauvegardé, qui lui-même utilise la cendre moyenne calculée à partir des analyses de la page \"Analyses Cendres\". La chaîne de données est donc complète et cohérente.",
                 "Point de Vérité : Ce rapport représente le \"point de vérité\" de la situation opérationnelle au moment de l'enregistrement, ce qui le rend fiable pour les réunions de production ou les audits."
            ]
        },
        {
            title: "3. Fonctionnalité d'Exportation",
            content: "L'une des fonctionnalités clés de cette page est sa capacité à générer des documents propres et professionnels.",
            points: [
                "Exporter en PDF : Crée un document PDF bien formaté, idéal pour l'archivage numérique ou l'envoi par email. Il inclut toutes les sections du rapport.",
                "Exporter en Word : Génère un fichier .docx qui peut être facilement édité, pour y ajouter des commentaires, des analyses supplémentaires, ou pour l'intégrer dans un rapport plus large."
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

    doc.save(`Principe_Rapport_Synthese_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Fonctionnement du Rapport de Synthèse", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page \"Rapport de Synthèse\" est un tableau de bord consolidé qui rassemble les informations les plus critiques de vos simulations. Elle a été conçue pour fournir une vue d'ensemble claire et immédiate, prête à être partagée, archivée ou discutée."),
        new Paragraph("Son objectif est de synthétiser en un seul endroit les résultats du \"Calcul de Mélange\" et du \"Calcul d'Impact\", vous offrant ainsi une vision complète de la situation actuelle, de la recette de combustible à son effet final sur le clinker."),

        new Paragraph({ text: "1. Les Composants du Rapport", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Le rapport est divisé en plusieurs cartes logiques qui présentent les données de manière structurée."),
        new Paragraph({ text: "Indicateurs du Mélange : Cette carte affiche les caractéristiques finales du mélange de combustibles (PCI, Chlore, Cendres, etc.) telles que définies dans la page \"Calcul de Mélange\". Les couleurs (vert, jaune, rouge) vous indiquent immédiatement la conformité par rapport aux seuils que vous avez définis.", bullet: { level: 0 } }),
        new Paragraph({ text: "Impact sur le Clinker : Ce graphique à barres visualise le \"delta\" (la variation) des indicateurs clés du clinker (LSF, C3S, etc.) entre un clinker théorique (sans cendres) et le clinker calculé (avec les cendres du mélange). C'est un résumé visuel direct de la page \"Calcul d'Impact\".", bullet: { level: 0 } }),
        new Paragraph({ text: "Composition (Godets) : Un tableau simple qui liste le nombre de godets pour chaque combustible utilisé dans la recette actuelle du mélange.", bullet: { level: 0 } }),
        new Paragraph({ text: "Répartition du Mélange (% Poids) : Un graphique qui montre la part en pourcentage de chaque combustible dans le poids total du mélange, permettant de visualiser rapidement les contributeurs majoritaires.", bullet: { level: 0 } }),

        new Paragraph({ text: "2. Relation avec les Autres Pages (Le Cœur du Système)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Cette page est la destination finale des données calculées dans d'autres modules. Elle ne génère pas de nouvelles informations mais les agrège de manière intelligente :"),
        new Paragraph({ text: "Source des Données : Toutes les informations affichées proviennent de la dernière \"session de mélange\" enregistrée. Lorsque vous cliquez sur \"Enregistrer la Session\" dans la page \"Calcul de Mélange\", vous créez un instantané qui alimente ce rapport.", bullet: { level: 0 } }),
        new Paragraph({ text: "Lien avec le Calcul d'Impact : Le graphique d'impact se base sur le dernier calcul d'impact sauvegardé, qui lui-même utilise la cendre moyenne calculée à partir des analyses de la page \"Analyses Cendres\". La chaîne de données est donc complète et cohérente.", bullet: { level: 0 } }),
        new Paragraph({ text: "Point de Vérité : Ce rapport représente le \"point de vérité\" de la situation opérationnelle au moment de l'enregistrement, ce qui le rend fiable pour les réunions de production ou les audits.", bullet: { level: 0 } }),

        new Paragraph({ text: "3. Fonctionnalité d'Exportation", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("L'une des fonctionnalités clés de cette page est sa capacité à générer des documents propres et professionnels."),
        new Paragraph({ text: "Exporter en PDF : Crée un document PDF bien formaté, idéal pour l'archivage numérique ou l'envoi par email. Il inclut toutes les sections du rapport.", bullet: { level: 0 } }),
        new Paragraph({ text: "Exporter en Word : Génère un fichier .docx qui peut être facilement édité, pour y ajouter des commentaires, des analyses supplémentaires, ou pour l'intégrer dans un rapport plus large.", bullet: { level: 0 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Rapport_Synthese_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <FilePieChart className="h-8 w-8 text-primary" />
          Fonctionnement du Rapport de Synthèse
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique comment le rapport de synthèse consolide les données de mélange et d'impact pour une vue d'ensemble.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Rapport de Synthèse" est un tableau de bord consolidé qui rassemble les informations les plus critiques de vos simulations. Elle a été conçue pour fournir une vue d'ensemble claire et immédiate, prête à être partagée, archivée ou discutée.
          </p>
          <p>
            Son objectif est de synthétiser en un seul endroit les résultats du "Calcul de Mélange" et du "Calcul d'Impact", vous offrant ainsi une vision complète de la situation actuelle, de la recette de combustible à son effet final sur le clinker.
          </p>
          
          <h2>1. Les Composants du Rapport</h2>
          <p>
            Le rapport est divisé en plusieurs cartes logiques qui présentent les données de manière structurée.
          </p>
          <ul>
            <li><strong>Indicateurs du Mélange :</strong> Cette carte affiche les caractéristiques finales du mélange de combustibles (PCI, Chlore, Cendres, etc.) telles que définies dans la page "Calcul de Mélange". Les couleurs (vert, jaune, rouge) vous indiquent immédiatement la conformité par rapport aux seuils que vous avez définis.</li>
            <li><strong>Impact sur le Clinker :</strong> Ce graphique à barres visualise le "delta" (la variation) des indicateurs clés du clinker (LSF, C3S, etc.) entre un clinker théorique (sans cendres) et le clinker calculé (avec les cendres du mélange). C'est un résumé visuel direct de la page "Calcul d'Impact".</li>
            <li><strong>Composition (Godets) :</strong> Un tableau simple qui liste le nombre de godets pour chaque combustible utilisé dans la recette actuelle du mélange.</li>
            <li><strong>Répartition du Mélange (% Poids) :</strong> Un graphique qui montre la part en pourcentage de chaque combustible dans le poids total du mélange, permettant de visualiser rapidement les contributeurs majoritaires.</li>
          </ul>

          <h2>2. Relation avec les Autres Pages (Le Cœur du Système)</h2>
          <p>
            Cette page est la destination finale des données calculées dans d'autres modules. Elle ne génère pas de nouvelles informations mais les agrège de manière intelligente :
          </p>
          <ul>
            <li><strong>Source des Données :</strong> Toutes les informations affichées proviennent de la dernière "session de mélange" enregistrée. Lorsque vous cliquez sur "Enregistrer la Session" dans la page "Calcul de Mélange", vous créez un instantané qui alimente ce rapport.</li>
            <li><strong>Lien avec le Calcul d'Impact :</strong> Le graphique d'impact se base sur le dernier calcul d'impact sauvegardé, qui lui-même utilise la cendre moyenne calculée à partir des analyses de la page "Analyses Cendres". La chaîne de données est donc complète et cohérente.</li>
            <li><strong>Point de Vérité :</strong> Ce rapport représente le "point de vérité" de la situation opérationnelle au moment de l'enregistrement, ce qui le rend fiable pour les réunions de production ou les audits.</li>
          </ul>

          <h2>3. Fonctionnalité d'Exportation</h2>
           <p>
            L'une des fonctionnalités clés de cette page est sa capacité à générer des documents propres et professionnels.
          </p>
          <ul>
            <li><strong>Exporter en PDF :</strong> Crée un document PDF bien formaté, idéal pour l'archivage numérique ou l'envoi par email. Il inclut toutes les sections du rapport.</li>
            <li><strong>Exporter en Word :</strong> Génère un fichier .docx qui peut être facilement édité, pour y ajouter des commentaires, des analyses supplémentaires, ou pour l'intégrer dans un rapport plus large.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
