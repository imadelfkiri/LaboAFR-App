"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Beaker } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export default function PrincipeCalculMelangePage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Principe du Calcul de Mélange", page_width / 2, yPos, { align: "center" });
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
      "La page \"Calcul de Mélange\" est l'outil opérationnel principal pour piloter l'alimentation du four. Elle permet de simuler en temps réel une recette de mélange de combustibles en combinant les apports de différentes installations (Hall des AF, ATS) et des combustibles directs (Grignons, Pet-Coke).",
      "L'objectif est d'atteindre les cibles de qualité (PCI, Chlore, Cendres, etc.) tout en optimisant les coûts et le taux de substitution. Chaque ajustement, que ce soit le nombre de godets ou un débit, met à jour instantanément les indicateurs globaux du mélange."
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
            title: "1. Panneau des Indicateurs Globaux",
            content: "Situé en haut de la page, ce bandeau affiche en temps réel les caractéristiques consolidées du mélange que vous êtes en train de créer. C'est votre tableau de bord principal.",
            points: [
                "Débit des AFs : Somme des débits (en t/h) des installations \"Hall des AF\" et \"ATS\".",
                "PCI moyen : Pouvoir Calorifique Inférieur moyen du mélange, pondéré par le débit de chaque installation.",
                "% Humidité, % Cendres, % Chlorures : Teneurs moyennes pondérées du mélange.",
                "Taux de pneus : Pourcentage en poids des pneus dans le mélange total des AFs (hors grignons et pet-coke).",
                "Coût du Mélange : Coût moyen pondéré du mélange en MAD/t, basé sur les coûts définis dans \"Gestion des Coûts\".",
                "Validation par couleur : Chaque indicateur change de couleur (vert, jaune, rouge) en fonction des seuils que vous avez définis, vous alertant immédiatement d'une non-conformité."
            ]
        },
        {
            title: "2. Les Installations de Mélange (Hall des AF & ATS)",
            content: "Ces deux cartes représentent les lignes d'alimentation principales pour les combustibles alternatifs solides.",
            points: [
                 "Débit (t/h) : Pour chaque installation, vous définissez le débit total qui sera envoyé au four.",
                 "Liste des combustibles : Chaque combustible disponible apparaît avec un champ pour saisir le nombre de godets.",
                 "Calcul de la composition : L'application calcule la composition interne du mélange de chaque installation (ex: le PCI moyen du Hall des AF) en se basant sur le nombre de godets et le poids par godet de chaque combustible.",
                 "Pondération finale : Les indicateurs de chaque installation sont ensuite pondérés par le débit que vous avez défini pour contribuer aux indicateurs globaux."
            ]
        },
        {
            title: "3. Autres Combustibles (Entrées Directes)",
            content: "Cette section permet d'ajouter au bilan énergétique des combustibles qui ne font pas partie du mélange des AFs mais qui sont injectés directement, comme les grignons d'olive ou le pet-coke.",
            points: [
                "Débit (t/h) : Vous saisissez manuellement le débit pour chaque combustible direct.",
                "Impact sur les indicateurs : Leurs caractéristiques (PCI, Chlore, etc.) sont prises en compte dans le calcul des indicateurs globaux, mais ils ne sont pas inclus dans le \"Débit des AFs\"."
            ]
        },
        {
            title: "4. Actions et Fonctionnalités",
            points: [
                "Période d'analyse : Vous pouvez définir une plage de dates pour que les analyses chimiques de chaque combustible soient calculées sur cette période, affinant ainsi la simulation.",
                "Suggérer un mélange (IA) : En cliquant sur ce bouton, vous pouvez décrire un objectif (ex: \"un PCI de 5800 avec le moins de chlore possible\"). L'IA analysera les combustibles disponibles et vous proposera une recette (nombre de godets) pour atteindre cet objectif.",
                "Enregistrer la Session : Une fois votre recette de mélange finalisée, ce bouton enregistre un \"instantané\" de toute la configuration (débits, godets, indicateurs). Cet enregistrement alimente les pages d'historique et de statistiques (ex: la page Indicateurs)."
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

    doc.save(`Principe_Calcul_Melange_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Principe du Calcul de Mélange", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page \"Calcul de Mélange\" est l'outil opérationnel principal pour piloter l'alimentation du four. Elle permet de simuler en temps réel une recette de mélange de combustibles en combinant les apports de différentes installations (Hall des AF, ATS) et des combustibles directs (Grignons, Pet-Coke)."),
        new Paragraph("L'objectif est d'atteindre les cibles de qualité (PCI, Chlore, Cendres, etc.) tout en optimisant les coûts et le taux de substitution. Chaque ajustement, que ce soit le nombre de godets ou un débit, met à jour instantanément les indicateurs globaux du mélange."),

        new Paragraph({ text: "1. Panneau des Indicateurs Globaux", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Situé en haut de la page, ce bandeau affiche en temps réel les caractéristiques consolidées du mélange que vous êtes en train de créer. C'est votre tableau de bord principal."),
        new Paragraph({ text: "Débit des AFs : Somme des débits (en t/h) des installations \"Hall des AF\" et \"ATS\".", bullet: { level: 0 } }),
        new Paragraph({ text: "PCI moyen : Pouvoir Calorifique Inférieur moyen du mélange, pondéré par le débit de chaque installation.", bullet: { level: 0 } }),
        new Paragraph({ text: "% Humidité, % Cendres, % Chlorures : Teneurs moyennes pondérées du mélange.", bullet: { level: 0 } }),
        new Paragraph({ text: "Taux de pneus : Pourcentage en poids des pneus dans le mélange total des AFs (hors grignons et pet-coke).", bullet: { level: 0 } }),
        new Paragraph({ text: "Coût du Mélange : Coût moyen pondéré du mélange en MAD/t, basé sur les coûts définis dans \"Gestion des Coûts\".", bullet: { level: 0 } }),
        new Paragraph({ text: "Validation par couleur : Chaque indicateur change de couleur (vert, jaune, rouge) en fonction des seuils que vous avez définis, vous alertant immédiatement d'une non-conformité.", bullet: { level: 0 } }),
        
        new Paragraph({ text: "2. Les Installations de Mélange (Hall des AF & ATS)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Ces deux cartes représentent les lignes d'alimentation principales pour les combustibles alternatifs solides."),
        new Paragraph({ text: "Débit (t/h) : Pour chaque installation, vous définissez le débit total qui sera envoyé au four.", bullet: { level: 0 } }),
        new Paragraph({ text: "Liste des combustibles : Chaque combustible disponible apparaît avec un champ pour saisir le nombre de godets.", bullet: { level: 0 } }),
        new Paragraph({ text: "Calcul de la composition : L'application calcule la composition interne du mélange de chaque installation (ex: le PCI moyen du Hall des AF) en se basant sur le nombre de godets et le poids par godet de chaque combustible.", bullet: { level: 0 } }),
        new Paragraph({ text: "Pondération finale : Les indicateurs de chaque installation sont ensuite pondérés par le débit que vous avez défini pour contribuer aux indicateurs globaux.", bullet: { level: 0 } }),

        new Paragraph({ text: "3. Autres Combustibles (Entrées Directes)", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Cette section permet d'ajouter au bilan énergétique des combustibles qui ne font pas partie du mélange des AFs mais qui sont injectés directement, comme les grignons d'olive ou le pet-coke."),
        new Paragraph({ text: "Débit (t/h) : Vous saisissez manuellement le débit pour chaque combustible direct.", bullet: { level: 0 } }),
        new Paragraph({ text: "Impact sur les indicateurs : Leurs caractéristiques (PCI, Chlore, etc.) sont prises en compte dans le calcul des indicateurs globaux, mais ils ne sont pas inclus dans le \"Débit des AFs\".", bullet: { level: 0 } }),
        
        new Paragraph({ text: "4. Actions et Fonctionnalités", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph({ text: "Période d'analyse : Vous pouvez définir une plage de dates pour que les analyses chimiques de chaque combustible soient calculées sur cette période, affinant ainsi la simulation.", bullet: { level: 0 } }),
        new Paragraph({ text: "Suggérer un mélange (IA) : En cliquant sur ce bouton, vous pouvez décrire un objectif (ex: \"un PCI de 5800 avec le moins de chlore possible\"). L'IA analysera les combustibles disponibles et vous proposera une recette (nombre de godets) pour atteindre cet objectif.", bullet: { level: 0 } }),
        new Paragraph({ text: "Enregistrer la Session : Une fois votre recette de mélange finalisée, ce bouton enregistre un \"instantané\" de toute la configuration (débits, godets, indicateurs). Cet enregistrement alimente les pages d'historique et de statistiques (ex: la page Indicateurs).", bullet: { level: 0 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Calcul_Melange_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <Beaker className="h-8 w-8 text-primary" />
          Principe du Calcul de Mélange
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-h3:text-emerald-400 prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Cette page explique la logique, les calculs et les fonctionnalités de l'outil de simulation de mélange de combustibles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Calcul de Mélange" est l'outil opérationnel principal pour piloter l'alimentation du four. Elle permet de simuler en temps réel une recette de mélange de combustibles en combinant les apports de différentes installations (Hall des AF, ATS) et des combustibles directs (Grignons, Pet-Coke).
          </p>
          <p>
            L'objectif est d'atteindre les cibles de qualité (PCI, Chlore, Cendres, etc.) tout en optimisant les coûts et le taux de substitution. Chaque ajustement, que ce soit le nombre de godets ou un débit, met à jour instantanément les indicateurs globaux du mélange.
          </p>

          <h2>1. Panneau des Indicateurs Globaux</h2>
          <p>
            Situé en haut de la page, ce bandeau affiche en temps réel les caractéristiques consolidées du mélange que vous êtes en train de créer. C'est votre tableau de bord principal.
          </p>
          <ul>
            <li><strong>Débit des AFs :</strong> Somme des débits (en t/h) des installations "Hall des AF" et "ATS".</li>
            <li><strong>PCI moyen :</strong> Pouvoir Calorifique Inférieur moyen du mélange, pondéré par le débit de chaque installation.</li>
            <li><strong>% Humidité, % Cendres, % Chlorures :</strong> Teneurs moyennes pondérées du mélange.</li>
            <li><strong>Taux de pneus :</strong> Pourcentage en poids des pneus dans le mélange total des AFs (hors grignons et pet-coke).</li>
            <li><strong>Coût du Mélange :</strong> Coût moyen pondéré du mélange en MAD/t, basé sur les coûts définis dans "Gestion des Coûts".</li>
            <li><strong>Validation par couleur :</strong> Chaque indicateur change de couleur (vert, jaune, rouge) en fonction des seuils que vous avez définis, vous alertant immédiatement d'une non-conformité.</li>
          </ul>
          
          <h2>2. Les Installations de Mélange (Hall des AF & ATS)</h2>
          <p>
            Ces deux cartes représentent les lignes d'alimentation principales pour les combustibles alternatifs solides.
          </p>
          <ul>
            <li><strong>Débit (t/h) :</strong> Pour chaque installation, vous définissez le débit total qui sera envoyé au four.</li>
            <li><strong>Liste des combustibles :</strong> Chaque combustible disponible apparaît avec un champ pour saisir le nombre de godets.</li>
            <li><strong>Calcul de la composition :</strong> L'application calcule la composition interne du mélange de chaque installation (ex: le PCI moyen du Hall des AF) en se basant sur le nombre de godets et le poids par godet de chaque combustible.</li>
            <li><strong>Pondération finale :</strong> Les indicateurs de chaque installation sont ensuite pondérés par le débit que vous avez défini pour contribuer aux indicateurs globaux.</li>
          </ul>

          <h2>3. Autres Combustibles (Entrées Directes)</h2>
          <p>
            Cette section permet d'ajouter au bilan énergétique des combustibles qui ne font pas partie du mélange des AFs mais qui sont injectés directement, comme les grignons d'olive ou le pet-coke.
          </p>
          <ul>
            <li><strong>Débit (t/h) :</strong> Vous saisissez manuellement le débit pour chaque combustible direct.</li>
            <li><strong>Impact sur les indicateurs :</strong> Leurs caractéristiques (PCI, Chlore, etc.) sont prises en compte dans le calcul des indicateurs globaux, mais ils ne sont pas inclus dans le "Débit des AFs".</li>
          </ul>

          <h2>4. Actions et Fonctionnalités</h2>
          <ul>
            <li><strong>Période d'analyse :</strong> Vous pouvez définir une plage de dates pour que les analyses chimiques de chaque combustible soient calculées sur cette période, affinant ainsi la simulation.</li>
            <li><strong>Suggérer un mélange (IA) :</strong> En cliquant sur ce bouton, vous pouvez décrire un objectif (ex: "un PCI de 5800 avec le moins de chlore possible"). L'IA analysera les combustibles disponibles et vous proposera une recette (nombre de godets) pour atteindre cet objectif.</li>
            <li><strong>Enregistrer la Session :</strong> Une fois votre recette de mélange finalisée, ce bouton enregistre un "instantané" de toute la configuration (débits, godets, indicateurs). Cet enregistrement alimente les pages d'historique et de statistiques (ex: la page Indicateurs).</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
