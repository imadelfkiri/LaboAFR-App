
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export default function PrincipeTableauDeBordPage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement du Tableau de Bord", page_width / 2, yPos, { align: "center" });
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
      "Le Tableau de Bord est la page d'accueil de l'application, conçue pour fournir une vue d'ensemble immédiate et synthétique des indicateurs les plus importants. Il agrège les informations clés issues des autres modules pour permettre une prise de décision rapide.",
      "Il sert de point de contrôle central pour évaluer la performance énergétique actuelle, la qualité du mélange de combustibles et son impact prévisionnel sur le clinker."
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
            title: "1. Les Indicateurs de Performance Énergétique",
            content: "Cette carte centrale affiche deux des métriques les plus importantes pour le pilotage du four.",
            points: [
                "Taux de Substitution Énergétique (TSR) : Représenté par une jauge circulaire, il indique la part (en %) de l'énergie totale fournie au four qui provient des combustibles alternatifs (AFs et Grignons). Un TSR élevé est généralement un objectif clé.",
                "Consommation Calorifique (CC) : Indique l'énergie nécessaire pour produire une tonne de clinker (en kcal/kg). Il est calculé en se basant sur le débit de clinker que vous avez défini dans la page \"Calcul d'Impact\"."
            ]
        },
        {
            title: "2. Les Cartes de Synthèse",
            content: "Ces cartes sont des résumés directs des dernières simulations que vous avez enregistrées.",
            points: [
                 "Indicateurs du Mélange : Affiche les caractéristiques finales (PCI, Chlore, Cendres, etc.) du mélange de combustibles tel que défini et sauvegardé depuis la page \"Calcul de Mélange\". Les couleurs vous alertent de la conformité par rapport aux seuils.",
                 "Impact sur le Clinker : Reprend les variations (Δ) calculées dans la page \"Calcul d'Impact\", montrant l'effet des cendres de votre mélange sur la composition du clinker (Δ LSF, Δ C3S, etc.).",
            ]
        },
        {
            title: "3. Graphique des Moyennes par Fournisseur",
            content: "Ce graphique à barres est un outil d'analyse rapide pour la qualité des arrivages.",
            points: [
                "Filtres : Vous pouvez sélectionner un indicateur (PCI, H2O, etc.) et une période. Le graphique se met à jour pour afficher les performances moyennes de chaque fournisseur pour cet indicateur et sur cette période.",
                "Objectif : Permet d'identifier rapidement si un fournisseur livre une qualité constante, ou de comparer la qualité moyenne de plusieurs fournisseurs sur une même période.",
            ]
        },
        {
            title: "4. Relation avec les Autres Pages (Source des Données)",
            content: "Le tableau de bord est un agrégateur. Il ne génère pas de données lui-même mais les présente de manière consolidée :",
            points: [
                 "Les cartes \"Indicateurs du Mélange\" et \"Performance Énergétique\" sont alimentées par la **dernière session enregistrée** depuis la page \"Calcul de Mélange\".",
                 "La carte \"Impact sur le Clinker\" est basée sur la **dernière analyse sauvegardée** depuis la page \"Calcul d'Impact\".",
                 "Le graphique \"Moyenne par Fournisseur\" utilise toutes les analyses enregistrées dans la base de données de la page \"Résultats\".",
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

    doc.save(`Principe_Tableau_De_Bord_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Fonctionnement du Tableau de Bord", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Le Tableau de Bord est la page d'accueil de l'application, conçue pour fournir une vue d'ensemble immédiate et synthétique des indicateurs les plus importants. Il agrège les informations clés issues des autres modules pour permettre une prise de décision rapide."),
        new Paragraph("Il sert de point de contrôle central pour évaluer la performance énergétique actuelle, la qualité du mélange de combustibles et son impact prévisionnel sur le clinker."),

        new Paragraph({ text: "1. Les Indicateurs de Performance Énergétique", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Cette carte centrale affiche deux des métriques les plus importantes pour le pilotage du four."),
        new Paragraph({ text: "Taux de Substitution Énergétique (TSR) : Représenté par une jauge circulaire, il indique la part (en %) de l'énergie totale fournie au four qui provient des combustibles alternatifs (AFs et Grignons). Un TSR élevé est généralement un objectif clé.", bullet: { level: 0 } }),
        new Paragraph({ text: "Consommation Calorifique (CC) : Indique l'énergie nécessaire pour produire une tonne de clinker (en kcal/kg). Il est calculé en se basant sur le débit de clinker que vous avez défini dans la page \"Calcul d'Impact\".", bullet: { level: 0 } }),
        
        new Paragraph({ text: "2. Les Cartes de Synthèse", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Ces cartes sont des résumés directs des dernières simulations que vous avez enregistrées."),
        new Paragraph({ text: "Indicateurs du Mélange : Affiche les caractéristiques finales (PCI, Chlore, Cendres, etc.) du mélange de combustibles tel que défini et sauvegardé depuis la page \"Calcul de Mélange\". Les couleurs vous alertent de la conformité par rapport aux seuils.", bullet: { level: 0 } }),
        new Paragraph({ text: "Impact sur le Clinker : Reprend les variations (Δ) calculées dans la page \"Calcul d'Impact\", montrant l'effet des cendres de votre mélange sur la composition du clinker (Δ LSF, Δ C3S, etc.).", bullet: { level: 0 } }),
        
        new Paragraph({ text: "3. Graphique des Moyennes par Fournisseur", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Ce graphique à barres est un outil d'analyse rapide pour la qualité des arrivages."),
        new Paragraph({ text: "Filtres : Vous pouvez sélectionner un indicateur (PCI, H2O, etc.) et une période. Le graphique se met à jour pour afficher les performances moyennes de chaque fournisseur pour cet indicateur et sur cette période.", bullet: { level: 0 } }),
        new Paragraph({ text: "Objectif : Permet d'identifier rapidement si un fournisseur livre une qualité constante, ou de comparer la qualité moyenne de plusieurs fournisseurs sur une même période.", bullet: { level: 0 } }),

        new Paragraph({ text: "4. Relation avec les Autres Pages (Source des Données)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Le tableau de bord est un agrégateur. Il ne génère pas de données lui-même mais les présente de manière consolidée :"),
        new Paragraph({ text: "Les cartes \"Indicateurs du Mélange\" et \"Performance Énergétique\" sont alimentées par la dernière session enregistrée depuis la page \"Calcul de Mélange\".", bullet: { level: 0 } }),
        new Paragraph({ text: "La carte \"Impact sur le Clinker\" est basée sur la dernière analyse sauvegardée depuis la page \"Calcul d'Impact\".", bullet: { level: 0 } }),
        new Paragraph({ text: "Le graphique \"Moyenne par Fournisseur\" utilise toutes les analyses enregistrées dans la base de données de la page \"Résultats\".", bullet: { level: 0 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Tableau_De_Bord_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <LayoutDashboard className="h-8 w-8 text-primary" />
          Fonctionnement du Tableau de Bord
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique le fonctionnement des indicateurs et graphiques du tableau de bord principal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            Le Tableau de Bord est la page d'accueil de l'application, conçue pour fournir une vue d'ensemble immédiate et synthétique des indicateurs les plus importants. Il agrège les informations clés issues des autres modules pour permettre une prise de décision rapide.
          </p>
          <p>
            Il sert de point de contrôle central pour évaluer la performance énergétique actuelle, la qualité du mélange de combustibles et son impact prévisionnel sur le clinker.
          </p>
          
          <h2>1. Les Indicateurs de Performance Énergétique</h2>
          <p>
            Cette carte centrale affiche deux des métriques les plus importantes pour le pilotage du four.
          </p>
          <ul>
            <li><strong>Taux de Substitution Énergétique (TSR) :</strong> Représenté par une jauge circulaire, il indique la part (en %) de l'énergie totale fournie au four qui provient des combustibles alternatifs (AFs et Grignons). Un TSR élevé est généralement un objectif clé.</li>
            <li><strong>Consommation Calorifique (CC) :</strong> Indique l'énergie nécessaire pour produire une tonne de clinker (en kcal/kg). Il est calculé en se basant sur le débit de clinker que vous avez défini dans la page "Calcul d'Impact".</li>
          </ul>

          <h2>2. Les Cartes de Synthèse</h2>
          <p>
            Ces cartes sont des résumés directs des dernières simulations que vous avez enregistrées.
          </p>
          <ul>
            <li><strong>Indicateurs du Mélange :</strong> Affiche les caractéristiques finales (PCI, Chlore, Cendres, etc.) du mélange de combustibles tel que défini et sauvegardé depuis la page "Calcul de Mélange". Les couleurs vous alertent de la conformité par rapport aux seuils.</li>
            <li><strong>Impact sur le Clinker :</strong> Reprend les variations (Δ) calculées dans la page "Calcul d'Impact", montrant l'effet des cendres de votre mélange sur la composition du clinker (Δ LSF, Δ C3S, etc.).</li>
          </ul>

          <h2>3. Graphique des Moyennes par Fournisseur</h2>
          <p>
            Ce graphique à barres est un outil d'analyse rapide pour la qualité des arrivages.
          </p>
          <ul>
            <li><strong>Filtres :</strong> Vous pouvez sélectionner un indicateur (PCI, H2O, etc.) et une période. Le graphique se met à jour pour afficher les performances moyennes de chaque fournisseur pour cet indicateur et sur cette période.</li>
            <li><strong>Objectif :</strong> Permet d'identifier rapidement si un fournisseur livre une qualité constante, ou de comparer la qualité moyenne de plusieurs fournisseurs sur une même période.</li>
          </ul>

          <h2>4. Relation avec les Autres Pages (Source des Données)</h2>
          <p>
            Le tableau de bord est un agrégateur. Il ne génère pas de données lui-même mais les présente de manière consolidée :
          </p>
          <ul>
            <li>Les cartes "Indicateurs du Mélange" et "Performance Énergétique" sont alimentées par la <strong>dernière session enregistrée</strong> depuis la page "Calcul de Mélange".</li>
            <li>La carte "Impact sur le Clinker" est basée sur la <strong>dernière analyse sauvegardée</strong> depuis la page "Calcul d'Impact".</li>
            <li>Le graphique "Moyenne par Fournisseur" utilise toutes les analyses enregistrées dans la base de données de la page "Résultats".</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
