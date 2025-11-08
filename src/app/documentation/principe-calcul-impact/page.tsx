"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookText } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';

export default function PrincipeCalculImpactPage() {

  const handleExport = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Titre
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Principe du Calcul d'Impact des Cendres", page_width / 2, yPos, { align: "center" });
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Document généré le ${date}`, page_width / 2, yPos, { align: "center" });
    yPos += 15;

    // Introduction
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Introduction", margin, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const introText = [
      "L'utilisation de combustibles alternatifs (AF) en cimenterie est une pratique essentielle pour des raisons économiques et environnementales. Cependant, les cendres générées par leur combustion s'incorporent au clinker et modifient sa composition chimique. L'outil de \"Calcul d'Impact\" de l'application FuelTrack AFR permet de simuler et de quantifier précisément cet effet.",
      "Le principe fondamental repose sur une comparaison entre deux scénarios :",
    ];
    for (const text of introText) {
        const lines = doc.splitTextToSize(text, page_width - margin * 2);
        for (const line of lines) {
            doc.text(line, margin, yPos);
            yPos += 6;
        }
        yPos += 4;
    }

    const scenarios = [
        "Clinker Théorique (Sans Cendres) : La composition du clinker qui serait obtenu si l'on utilisait uniquement la farine crue, sans aucun apport de cendres.",
        "Clinker Calculé (Avec Cendres) : La composition du clinker qui résulte du mélange de la farine crue et des cendres issues de tous les combustibles utilisés (AF, grignons, etc.).",
    ];
    for (const scenario of scenarios) {
        const lines = doc.splitTextToSize(scenario, page_width - margin * 2 - 10);
        doc.text("•", margin + 5, yPos);
        for (const line of lines) {
            doc.text(line, margin + 10, yPos);
            yPos += 6;
        }
        yPos+=2;
    }

    const conclusionIntro = "En analysant la différence (le \"delta\" - Δ) entre ces deux scénarios, l'opérateur peut anticiper les ajustements nécessaires et garantir la qualité du produit final.";
    const conclusionLines = doc.splitTextToSize(conclusionIntro, page_width - margin * 2);
    for (const line of conclusionLines) {
        doc.text(line, margin, yPos);
        yPos += 6;
    }
    yPos += 10;
    
    // Étapes
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Étapes du Calcul", margin, yPos);
    yPos += 8;

    const steps = [
        { 
            title: "1. Analyse du \"Clinker Sans Cendres\"",
            content: "Cette première étape consiste à simuler la production de clinker à partir de la farine crue seule.",
            points: [
                "Clinkérisation de la farine : On part de l'analyse chimique de la farine crue. La \"clinkérisation\" est un calcul de normalisation qui simule la perte au feu (PF) dans le four. La composition est recalculée sur une base de 100% après avoir retiré les éléments volatils, ce qui donne la composition théorique du clinker si aucune cendre n'était ajoutée.",
                "Calcul des modules : À partir de cette composition de clinker théorique, on calcule les modules clés (LSF, MS, AF) et la teneur en Alite (C₃S), qui sont des indicateurs fondamentaux de la qualité et de la réactivité du clinker."
            ]
        },
        {
            title: "2. Calcul de la Cendre Moyenne du Mélange",
            content: "Les cendres de chaque combustible ont une composition unique. L'application calcule d'abord une \"cendre moyenne pondérée\" qui représente la composition chimique de toutes les cendres qui seront produites par le mélange de combustibles en cours d'utilisation.",
            points: [
                 "Apport de chaque combustible : Pour chaque combustible (AF, grignons), on prend son débit (t/h) et son taux de cendres (%). On en déduit le débit de cendres (t/h) apporté par ce combustible.",
                 "Moyenne pondérée : La composition de la cendre moyenne est la moyenne des compositions de chaque cendre individuelle, pondérée par le débit de cendres de chaque combustible. Un combustible utilisé à un débit plus élevé aura plus d'influence sur la composition finale."
            ]
        },
        {
            title: "3. Analyse du \"Clinker Avec Cendres\"",
            content: "C'est le cœur de la simulation. On combine la farine crue et la cendre moyenne pour prédire la composition finale du clinker.",
            points: [
                "Bilan matière : On calcule les flux de chaque oxyde (SiO₂, Al₂O₃, CaO, etc.) provenant de la farine crue (déjà \"clinkérisée\") et ceux provenant de la cendre moyenne.",
                "Mélange et Normalisation : On additionne ces flux d'oxydes et on les rapporte au flux total de matière (farine non volatile + cendres totales) pour obtenir la composition en pourcentage du clinker final \"avec cendres\".",
                "Ajustement final : Cette composition est ensuite normalisée une dernière fois pour atteindre les cibles de SO₃ et de PF que vous avez définies, simulant ainsi les conditions finales du clinker.",
                "Calcul des modules finaux : Sur cette composition finale, on recalcule les modules (LSF, MS, AF) et la teneur en C₃S."
            ]
        },
        {
            title: "4. L'Interprétation des Résultats (le \"Delta\" Δ)",
            content: "La véritable valeur de l'outil réside dans la comparaison des deux scénarios. La différence (\"delta\") entre les indicateurs du \"Clinker Avec Cendres\" et ceux du \"Clinker Sans Cendres\" révèle l'impact direct de l'utilisation des combustibles alternatifs :",
            points: [
                "Δ LSF & Δ MS : Indiquent un changement dans la \"cuisabilité\" du cru. Par exemple, une baisse du LSF facilite la cuisson.",
                "Δ C₃S : C'est un indicateur crucial. Une baisse du C₃S peut signifier une diminution des résistances du ciment à court terme, ce qui pourrait nécessiter une correction en amont (par exemple, en ajustant la composition de la farine crue).",
                "Δ des autres oxydes (Fe₂O₃, etc.) : Permet d'anticiper des changements de couleur du ciment ou des variations dans la phase liquide du four."
            ]
        }
    ];

    for (const step of steps) {
        if (yPos > 260) { doc.addPage(); yPos = 20; }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(step.title, margin, yPos);
        yPos += 7;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        const contentLines = doc.splitTextToSize(step.content, page_width - margin * 2);
        for (const line of contentLines) {
            doc.text(line, margin, yPos);
            yPos += 6;
        }
        yPos += 4;
        
        for (const point of step.points) {
            if (yPos > 270) { doc.addPage(); yPos = 20; }
            const pointLines = doc.splitTextToSize(point, page_width - margin * 2 - 10);
            doc.text("•", margin + 5, yPos);
            for (const line of pointLines) {
                doc.text(line, margin + 10, yPos);
                yPos += 6;
            }
            yPos += 3;
        }
        yPos += 5;
    }

    doc.save(`Principe_Calcul_Impact_${date.replaceAll('/', '-')}.pdf`);
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
       <div className="flex justify-between items-center mb-6">
          <CardTitle className="text-3xl font-bold flex items-center gap-3">
            <BookText className="h-8 w-8 text-primary" />
            Principe du Calcul d'Impact des Cendres
          </CardTitle>
          <ExportButton onClick={handleExport} />
       </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-h3:text-emerald-400 prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="text-lg">
            Méthodologie détaillée de la simulation de l'effet des combustibles alternatifs sur la composition et la qualité du clinker.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            L'utilisation de combustibles alternatifs (AF) en cimenterie est une pratique essentielle pour des raisons économiques et environnementales. Cependant, les cendres générées par leur combustion s'incorporent au clinker et modifient sa composition chimique. L'outil de "Calcul d'Impact" de l'application FuelTrack AFR permet de simuler et de quantifier précisément cet effet.
          </p>
          <p>
            Le principe fondamental repose sur une **comparaison entre deux scénarios** :
          </p>
          <ol>
            <li><strong>Clinker Théorique (Sans Cendres) :</strong> La composition du clinker qui serait obtenu si l'on utilisait uniquement la farine crue, sans aucun apport de cendres.</li>
            <li><strong>Clinker Calculé (Avec Cendres) :</strong> La composition du clinker qui résulte du mélange de la farine crue et des cendres issues de tous les combustibles utilisés (AF, grignons, etc.).</li>
          </ol>
          <p>
            En analysant la différence (le "delta" - Δ) entre ces deux scénarios, l'opérateur peut anticiper les ajustements nécessaires et garantir la qualité du produit final.
          </p>

          <h2>Étapes du Calcul</h2>
          
          <h3>1. Analyse du "Clinker Sans Cendres"</h3>
          <p>
            Cette première étape consiste à simuler la production de clinker à partir de la farine crue seule.
          </p>
          <ul>
            <li><strong>Clinkérisation de la farine :</strong> On part de l'analyse chimique de la farine crue. La "clinkérisation" est un calcul de normalisation qui simule la perte au feu (PF) dans le four. La composition est recalculée sur une base de 100% après avoir retiré les éléments volatils, ce qui donne la composition théorique du clinker si aucune cendre n'était ajoutée.</li>
            <li><strong>Calcul des modules :</strong> À partir de cette composition de clinker théorique, on calcule les modules clés (LSF, MS, AF) et la teneur en Alite (C₃S), qui sont des indicateurs fondamentaux de la qualité et de la réactivité du clinker.</li>
          </ul>

          <h3>2. Calcul de la Cendre Moyenne du Mélange</h3>
          <p>
            Les cendres de chaque combustible ont une composition unique. L'application calcule d'abord une "cendre moyenne pondérée" qui représente la composition chimique de toutes les cendres qui seront produites par le mélange de combustibles en cours d'utilisation.
          </p>
          <ul>
            <li><strong>Apport de chaque combustible :</strong> Pour chaque combustible (AF, grignons), on prend son débit (t/h) et son taux de cendres (%). On en déduit le débit de cendres (t/h) apporté par ce combustible.</li>
            <li><strong>Moyenne pondérée :</strong> La composition de la cendre moyenne est la moyenne des compositions de chaque cendre individuelle, pondérée par le débit de cendres de chaque combustible. Un combustible utilisé à un débit plus élevé aura plus d'influence sur la composition finale.</li>
          </ul>

          <h3>3. Analyse du "Clinker Avec Cendres"</h3>
          <p>
            C'est le cœur de la simulation. On combine la farine crue et la cendre moyenne pour prédire la composition finale du clinker.
          </p>
          <ul>
            <li><strong>Bilan matière :</strong> On calcule les flux de chaque oxyde (SiO₂, Al₂O₃, CaO, etc.) provenant de la farine crue (déjà "clinkérisée") et ceux provenant de la cendre moyenne.</li>
            <li><strong>Mélange et Normalisation :</strong> On additionne ces flux d'oxydes et on les rapporte au flux total de matière (farine non volatile + cendres totales) pour obtenir la composition en pourcentage du clinker final "avec cendres".</li>
            <li><strong>Ajustement final :</strong> Cette composition est ensuite normalisée une dernière fois pour atteindre les cibles de SO₃ et de PF que vous avez définies, simulant ainsi les conditions finales du clinker.</li>
            <li><strong>Calcul des modules finaux :</strong> Sur cette composition finale, on recalcule les modules (LSF, MS, AF) et la teneur en C₃S.</li>
          </ul>

          <h3>4. L'Interprétation des Résultats (le "Delta" Δ)</h3>
          <p>
            La véritable valeur de l'outil réside dans la comparaison des deux scénarios. La différence ("delta") entre les indicateurs du "Clinker Avec Cendres" et ceux du "Clinker Sans Cendres" révèle l'impact direct de l'utilisation des combustibles alternatifs :
          </p>
          <ul>
            <li><strong>Δ LSF & Δ MS :</strong> Indiquent un changement dans la "cuisabilité" du cru. Par exemple, une baisse du LSF facilite la cuisson.</li>
            <li><strong>Δ C₃S :</strong> C'est un indicateur crucial. Une baisse du C₃S peut signifier une diminution des résistances du ciment à court terme, ce qui pourrait nécessiter une correction en amont (par exemple, en ajustant la composition de la farine crue).</li>
            <li><strong>Δ des autres oxydes (Fe₂O₃, etc.) :</strong> Permet d'anticiper des changements de couleur du ciment ou des variations dans la phase liquide du four.</li>
          </ul>

          <h2>Conclusion</h2>
          <p>
            Cet outil de calcul d'impact est un simulateur puissant qui transforme des analyses chimiques brutes en informations décisionnelles. En comprenant comment les cendres affectent le produit final avant même qu'il ne soit cuit, les opérateurs peuvent ajuster les paramètres du processus de manière proactive, optimiser l'utilisation des combustibles alternatifs et garantir une qualité de clinker constante et conforme aux spécifications.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
