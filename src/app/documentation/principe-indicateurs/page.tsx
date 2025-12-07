"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import Link from 'next/link';

export default function PrincipeIndicateursPage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement de la Page Indicateurs", page_width / 2, yPos, { align: "center" });
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
      "La page \"Indicateurs\" est un tableau de bord focalisé sur la performance énergétique globale du four. Elle présente deux des indicateurs de performance clés (KPIs) les plus importants pour le pilotage d'une cimenterie.",
      "Son objectif est de fournir une vision claire et synthétique de l'efficacité énergétique de la substitution et de la consommation calorifique du four, basées sur la dernière session de mélange enregistrée."
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
            title: "1. Taux de Substitution Énergétique (TSR)",
            content: "Cet indicateur mesure la part de l'énergie totale fournie au four qui provient des combustibles de substitution (AFs et Grignons).",
            points: [
                "Calcul : Le TSR est calculé par la formule : (Énergie des AFs + Énergie des Grignons) / (Énergie Totale) x 100.",
                "Source des données : Les apports énergétiques (en Gcal/h) de chaque famille de combustible (AFs, Grignons, Pet-Coke) sont calculés en se basant sur les débits et les PCI moyens de la dernière session enregistrée dans la page \"Calcul de Mélange\".",
                "Importance : Un TSR élevé est un objectif économique et environnemental majeur. Cet indicateur permet de suivre en temps réel la performance de la stratégie de substitution."
            ]
        },
        {
            title: "2. Consommation Calorifique (CC)",
            content: "Cet indicateur mesure l'efficacité énergétique du four. Il représente la quantité d'énergie (en kcal) nécessaire pour produire un kilogramme de clinker.",
            points: [
                 "Calcul : La CC est calculée par la formule : (Énergie Totale en kcal/h) / (Production de clinker en kg/h).",
                 "Source des données : L'Énergie Totale vient du bilan énergétique de la dernière session. La production de clinker est directement liée au \"Débit Clinker\" que vous avez paramétré dans la page \"Calcul d'Impact\". Il est donc essentiel que cette valeur soit à jour pour avoir une Consommation Calorifique correcte.",
                 "Importance : Une consommation calorifique basse est synonyme d'un four performant et bien optimisé. Le suivi de cet indicateur permet de détecter des dérives dans le processus de cuisson."
            ]
        },
        {
            title: "3. Le Bilan Énergétique Détaillé",
            content: "Le tableau en bas de page décompose les calculs pour une transparence totale.",
            points: [
                "Débit (t/h) : Affiche le débit total pour chaque grande famille de combustibles (AFs, Grignons, Pet-Coke).",
                "PCI (kcal/kg) : Montre le PCI moyen pondéré pour chaque famille de combustibles.",
                "Apport Énergétique (Gcal/h) : Résultat du calcul Débit × PCI pour chaque famille.",
                "Contribution (%) : Indique la part en pourcentage de chaque famille de combustible dans l'apport énergétique total."
            ]
        },
         {
            title: "4. Relation avec les Autres Pages",
            content: "Cette page est un point de consolidation. Elle dépend directement des informations enregistrées dans d'autres modules :",
            points: [
                 "Calcul de Mélange : C'est la source principale. Chaque fois que vous \"Enregistrez la Session\" sur cette page, vous mettez à jour les données qui alimentent la page Indicateurs.",
                 "Calcul d'Impact : La valeur du \"Débit Clinker\" définie sur cette page est cruciale pour le calcul de la Consommation Calorifique. Assurez-vous qu'elle reflète la production réelle du four.",
                 "Données de Référence & Analyses : La précision des PCI utilisés dans le bilan énergétique dépend de la justesse des données de base (teneur H) et des analyses enregistrées.",
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

    doc.save(`Principe_Page_Indicateurs_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Fonctionnement de la Page Indicateurs", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page \"Indicateurs\" est un tableau de bord focalisé sur la performance énergétique globale du four. Elle présente deux des indicateurs de performance clés (KPIs) les plus importants pour le pilotage d'une cimenterie."),
        new Paragraph("Son objectif est de fournir une vision claire et synthétique de l'efficacité énergétique de la substitution et de la consommation calorifique du four, basées sur la dernière session de mélange enregistrée."),

        new Paragraph({ text: "1. Taux de Substitution Énergétique (TSR)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Cet indicateur mesure la part de l'énergie totale fournie au four qui provient des combustibles de substitution (AFs et Grignons)."),
        new Paragraph({ text: "Calcul : Le TSR est calculé par la formule : (Énergie des AFs + Énergie des Grignons) / (Énergie Totale) x 100.", bullet: { level: 0 } }),
        new Paragraph({ text: "Source des données : Les apports énergétiques (en Gcal/h) de chaque famille de combustible (AFs, Grignons, Pet-Coke) sont calculés en se basant sur les débits et les PCI moyens de la dernière session enregistrée dans la page \"Calcul de Mélange\".", bullet: { level: 0 } }),
        new Paragraph({ text: "Importance : Un TSR élevé est un objectif économique et environnemental majeur. Cet indicateur permet de suivre en temps réel la performance de la stratégie de substitution.", bullet: { level: 0 } }),
        
        new Paragraph({ text: "2. Consommation Calorifique (CC)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Cet indicateur mesure l'efficacité énergétique du four. Il représente la quantité d'énergie (en kcal) nécessaire pour produire un kilogramme de clinker."),
        new Paragraph({ text: "Calcul : La CC est calculée par la formule : (Énergie Totale en kcal/h) / (Production de clinker en kg/h).", bullet: { level: 0 } }),
        new Paragraph({ text: "Source des données : L'Énergie Totale vient du bilan énergétique de la dernière session. La production de clinker est directement liée au \"Débit Clinker\" que vous avez paramétré dans la page \"Calcul d'Impact\". Il est donc essentiel que cette valeur soit à jour pour avoir une Consommation Calorifique correcte.", bullet: { level: 0 } }),
        new Paragraph({ text: "Importance : Une consommation calorifique basse est synonyme d'un four performant et bien optimisé. Le suivi de cet indicateur permet de détecter des dérives dans le processus de cuisson.", bullet: { level: 0 } }),

        new Paragraph({ text: "3. Le Bilan Énergétique Détaillé", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Le tableau en bas de page décompose les calculs pour une transparence totale."),
        new Paragraph({ text: "Débit (t/h) : Affiche le débit total pour chaque grande famille de combustibles (AFs, Grignons, Pet-Coke).", bullet: { level: 0 } }),
        new Paragraph({ text: "PCI (kcal/kg) : Montre le PCI moyen pondéré pour chaque famille de combustibles.", bullet: { level: 0 } }),
        new Paragraph({ text: "Apport Énergétique (Gcal/h) : Résultat du calcul Débit × PCI pour chaque famille.", bullet: { level: 0 } }),
        new Paragraph({ text: "Contribution (%) : Indique la part en pourcentage de chaque famille de combustible dans l'apport énergétique total.", bullet: { level: 0 } }),
        
        new Paragraph({ text: "4. Relation avec les Autres Pages", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Cette page est un point de consolidation. Elle dépend directement des informations enregistrées dans d'autres modules :"),
        new Paragraph({ text: "Calcul de Mélange : C'est la source principale. Chaque fois que vous \"Enregistrez la Session\" sur cette page, vous mettez à jour les données qui alimentent la page Indicateurs.", bullet: { level: 0 } }),
        new Paragraph({ text: "Calcul d'Impact : La valeur du \"Débit Clinker\" définie sur cette page est cruciale pour le calcul de la Consommation Calorifique. Assurez-vous qu'elle reflète la production réelle du four.", bullet: { level: 0 } }),
        new Paragraph({ text: "Données de Référence & Analyses : La précision des PCI utilisés dans le bilan énergétique dépend de la justesse des données de base (teneur H) et des analyses enregistrées.", bullet: { level: 0 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Page_Indicateurs_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <TrendingUp className="h-8 w-8 text-primary" />
          Fonctionnement de la Page Indicateurs
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique le calcul et l'importance des indicateurs de performance énergétique (TSR, Consommation Calorifique).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Indicateurs" est un tableau de bord focalisé sur la performance énergétique globale du four. Elle présente deux des indicateurs de performance clés (KPIs) les plus importants pour le pilotage d'une cimenterie.
          </p>
          <p>
            Son objectif est de fournir une vision claire et synthétique de l'efficacité énergétique de la substitution et de la consommation calorifique du four, basées sur la dernière session de mélange enregistrée.
          </p>
          
          <h2>1. Taux de Substitution Énergétique (TSR)</h2>
          <p>
            Cet indicateur mesure la part de l'énergie totale fournie au four qui provient des combustibles de substitution (AFs et Grignons).
          </p>
          <ul>
            <li><strong>Calcul :</strong> Le TSR est calculé par la formule : <code>(Énergie des AFs + Énergie des Grignons) / (Énergie Totale) x 100</code>.</li>
            <li><strong>Source des données :</strong> Les apports énergétiques (en Gcal/h) de chaque famille de combustible (AFs, Grignons, Pet-Coke) sont calculés en se basant sur les débits et les PCI moyens de la dernière session enregistrée dans la page <Link href="/calcul-melange">Calcul de Mélange</Link>.</li>
            <li><strong>Importance :</strong> Un TSR élevé est un objectif économique et environnemental majeur. Cet indicateur permet de suivre en temps réel la performance de la stratégie de substitution.</li>
          </ul>

          <h2>2. Consommation Calorifique (CC)</h2>
          <p>
            Cet indicateur mesure l'efficacité énergétique du four. Il représente la quantité d'énergie (en kcal) nécessaire pour produire un kilogramme de clinker.
          </p>
          <ul>
            <li><strong>Calcul :</strong> La CC est calculée par la formule : <code>(Énergie Totale en kcal/h) / (Production de clinker en kg/h)</code>.</li>
            <li><strong>Source des données :</strong> L'Énergie Totale vient du bilan énergétique de la dernière session. La production de clinker est directement liée au <strong>"Débit Clinker"</strong> que vous avez paramétré dans la page <Link href="/calcul-impact">Calcul d'Impact</Link>. Il est donc essentiel que cette valeur soit à jour pour avoir une Consommation Calorifique correcte.</li>
            <li><strong>Importance :</strong> Une consommation calorifique basse est synonyme d'un four performant et bien optimisé. Le suivi de cet indicateur permet de détecter des dérives dans le processus de cuisson.</li>
          </ul>
          
          <h2>3. Le Bilan Énergétique Détaillé</h2>
           <p>
            Le tableau en bas de page décompose les calculs pour une transparence totale.
          </p>
          <ul>
            <li><strong>Débit (t/h) :</strong> Affiche le débit total pour chaque grande famille de combustibles (AFs, Grignons, Pet-Coke).</li>
            <li><strong>PCI (kcal/kg) :</strong> Montre le PCI moyen pondéré pour chaque famille de combustibles.</li>
            <li><strong>Apport Énergétique (Gcal/h) :</strong> Résultat du calcul Débit × PCI pour chaque famille.</li>
            <li><strong>Contribution (%) :</strong> Indique la part en pourcentage de chaque famille de combustible dans l'apport énergétique total.</li>
          </ul>

          <h2>4. Relation avec les Autres Pages</h2>
          <p>
            Cette page est un point de consolidation. Elle dépend directement des informations enregistrées dans d'autres modules :
          </p>
          <ul>
            <li><strong>Calcul de Mélange :</strong> C'est la source principale. Chaque fois que vous "Enregistrez la Session" sur cette page, vous mettez à jour les données qui alimentent la page Indicateurs.</li>
            <li><strong>Calcul d'Impact :</strong> La valeur du "Débit Clinker" définie sur cette page est cruciale pour le calcul de la Consommation Calorifique. Assurez-vous qu'elle reflète la production réelle du four.</li>
            <li><strong>Données de Référence & Analyses :</strong> La précision des PCI utilisés dans le bilan énergétique dépend de la justesse des données de base (teneur H) et des analyses enregistrées.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
