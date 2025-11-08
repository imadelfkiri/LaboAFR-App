"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import Link from 'next/link';

export default function PrincipeGestionCoutsPage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement de la Gestion des Coûts", page_width / 2, yPos, { align: "center" });
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
      "La page \"Gestion des Coûts\" est un outil essentiel pour le pilotage économique de l'utilisation des combustibles alternatifs. Elle permet de définir et de centraliser le coût par tonne (en MAD/t) pour chaque type de combustible.",
      "Son objectif est de fournir une base de données de coûts fiable qui sera utilisée par d'autres modules pour évaluer l'impact financier des recettes de mélange choisies. La maîtrise des coûts est aussi cruciale que la maîtrise des caractéristiques techniques."
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
            title: "1. L'Interface de Gestion des Coûts",
            content: "L'interface est conçue pour être simple et efficace, présentant un tableau clair de tous les combustibles et de leurs coûts associés.",
            points: [
                "Liste des Combustibles : Le tableau liste tous les types de combustibles disponibles dans l'application.",
                "Champ de Coût (MAD/t) : Pour chaque combustible, un champ de saisie vous permet d'entrer ou de mettre à jour son coût en dirhams par tonne.",
                "Bouton 'Enregistrer' : Chaque ligne a son propre bouton \"Enregistrer\". Cela vous permet de mettre à jour le coût d'un combustible spécifique sans avoir à sauvegarder toute la page, offrant une flexibilité maximale."
            ]
        },
        {
            title: "2. Relation avec les Autres Pages (Impact Direct)",
            content: "Les coûts que vous définissez ici sont activement utilisés par la page \"Calcul de Mélange\" pour fournir une analyse financière en temps réel.",
            points: [
                 "Calcul du Coût du Mélange : La page \"Calcul de Mélange\" récupère les coûts de cette section. Lorsque vous créez une recette en ajustant le nombre de godets et les débits, l'application calcule le coût moyen pondéré du mélange final.",
                 "Indicateur Global 'Coût du Mélange' : Cet indicateur, affiché en haut de la page de calcul, vous donne une vision immédiate du coût de votre recette actuelle en MAD/t. Il est mis à jour instantanément à chaque modification.",
                 "Optimisation Économique : En ayant une vision en temps réel du coût, les opérateurs peuvent non seulement viser des cibles techniques (PCI, Chlore) mais aussi optimiser leurs recettes pour qu'elles soient les plus économiques possible, en arbitrant entre différents combustibles."
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

    doc.save(`Principe_Gestion_Couts_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Fonctionnement de la Gestion des Coûts", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page \"Gestion des Coûts\" est un outil essentiel pour le pilotage économique de l'utilisation des combustibles alternatifs. Elle permet de définir et de centraliser le coût par tonne (en MAD/t) pour chaque type de combustible."),
        new Paragraph("Son objectif est de fournir une base de données de coûts fiable qui sera utilisée par d'autres modules pour évaluer l'impact financier des recettes de mélange choisies. La maîtrise des coûts est aussi cruciale que la maîtrise des caractéristiques techniques."),

        new Paragraph({ text: "1. L'Interface de Gestion des Coûts", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("L'interface est conçue pour être simple et efficace, présentant un tableau clair de tous les combustibles et de leurs coûts associés."),
        new Paragraph({ text: "Liste des Combustibles : Le tableau liste tous les types de combustibles disponibles dans l'application.", bullet: { level: 0 } }),
        new Paragraph({ text: "Champ de Coût (MAD/t) : Pour chaque combustible, un champ de saisie vous permet d'entrer ou de mettre à jour son coût en dirhams par tonne.", bullet: { level: 0 } }),
        new Paragraph({ text: "Bouton 'Enregistrer' : Chaque ligne a son propre bouton \"Enregistrer\". Cela vous permet de mettre à jour le coût d'un combustible spécifique sans avoir à sauvegarder toute la page, offrant une flexibilité maximale.", bullet: { level: 0 } }),
        
        new Paragraph({ text: "2. Relation avec les Autres Pages (Impact Direct)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Les coûts que vous définissez ici sont activement utilisés par la page \"Calcul de Mélange\" pour fournir une analyse financière en temps réel."),
        new Paragraph({ text: "Calcul du Coût du Mélange : La page \"Calcul de Mélange\" récupère les coûts de cette section. Lorsque vous créez une recette en ajustant le nombre de godets et les débits, l'application calcule le coût moyen pondéré du mélange final.", bullet: { level: 0 } }),
        new Paragraph({ text: "Indicateur Global 'Coût du Mélange' : Cet indicateur, affiché en haut de la page de calcul, vous donne une vision immédiate du coût de votre recette actuelle en MAD/t. Il est mis à jour instantanément à chaque modification.", bullet: { level: 0 } }),
        new Paragraph({ text: "Optimisation Économique : En ayant une vision en temps réel du coût, les opérateurs peuvent non seulement viser des cibles techniques (PCI, Chlore) mais aussi optimiser leurs recettes pour qu'elles soient les plus économiques possible, en arbitrant entre différents combustibles.", bullet: { level: 0 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Gestion_Couts_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <DollarSign className="h-8 w-8 text-primary" />
          Fonctionnement de la Gestion des Coûts
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique comment définir le coût des combustibles et comment cette information est utilisée dans l'application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Gestion des Coûts" est un outil essentiel pour le pilotage économique de l'utilisation des combustibles alternatifs. Elle permet de définir et de centraliser le coût par tonne (en MAD/t) pour chaque type de combustible.
          </p>
          <p>
            Son objectif est de fournir une base de données de coûts fiable qui sera utilisée par d'autres modules pour évaluer l'impact financier des recettes de mélange choisies. La maîtrise des coûts est aussi cruciale que la maîtrise des caractéristiques techniques.
          </p>
          
          <h2>1. L'Interface de Gestion des Coûts</h2>
          <p>
            L'interface est conçue pour être simple et efficace, présentant un tableau clair de tous les combustibles et de leurs coûts associés.
          </p>
          <ul>
            <li><strong>Liste des Combustibles :</strong> Le tableau liste tous les types de combustibles disponibles dans l'application.</li>
            <li><strong>Champ de Coût (MAD/t) :</strong> Pour chaque combustible, un champ de saisie vous permet d'entrer ou de mettre à jour son coût en dirhams par tonne.</li>
            <li><strong>Bouton 'Enregistrer' :</strong> Chaque ligne a son propre bouton "Enregistrer". Cela vous permet de mettre à jour le coût d'un combustible spécifique sans avoir à sauvegarder toute la page, offrant une flexibilité maximale.</li>
          </ul>

          <h2>2. Relation avec les Autres Pages (Impact Direct)</h2>
          <p>
            Les coûts que vous définissez ici sont activement utilisés par la page <Link href="/calcul-melange">Calcul de Mélange</Link> pour fournir une analyse financière en temps réel.
          </p>
          <ul>
            <li><strong>Calcul du Coût du Mélange :</strong> La page "Calcul de Mélange" récupère les coûts de cette section. Lorsque vous créez une recette en ajustant le nombre de godets et les débits, l'application calcule le coût moyen pondéré du mélange final.</li>
            <li><strong>Indicateur Global 'Coût du Mélange' :</strong> Cet indicateur, affiché en haut de la page de calcul, vous donne une vision immédiate du coût de votre recette actuelle en MAD/t. Il est mis à jour instantanément à chaque modification.</li>
            <li><strong>Optimisation Économique :</strong> En ayant une vision en temps réel du coût, les opérateurs peuvent non seulement viser des cibles techniques (PCI, Chlore) mais aussi optimiser leurs recettes pour qu'elles soient les plus économiques possible, en arbitrant entre différents combustibles.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
