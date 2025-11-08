
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FlaskConical } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export default function PrincipeSimulationMelangePage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement de la Simulation de Mélange", page_width / 2, yPos, { align: "center" });
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
      "La page \"Simulation de Mélange\" est un environnement de test, souvent appelé \"bac à sable\". Elle est conçue pour permettre aux opérateurs de créer et d'évaluer des recettes de mélange de manière totalement libre et isolée, sans impacter les données de production réelles ou les analyses enregistrées.",
      "Son objectif principal est de pouvoir répondre rapidement à des questions hypothétiques comme : \"Que se passerait-il si je recevais un combustible avec tel PCI et telle humidité ?\" ou \"Comment puis-je ajuster ma recette si un de mes combustibles habituels n'est plus disponible ?\"."
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
            title: "1. Principale Différence avec le \"Calcul de Mélange\"",
            content: "Contrairement à la page \"Calcul de Mélange\" qui utilise les analyses moyennes des combustibles stockées en base de données, la page de simulation vous donne le contrôle total. Pour chaque combustible, vous devez saisir manuellement toutes les caractéristiques :",
            points: [
                "Nombre de Godets : Comme dans le calculateur principal.",
                "PCI (kcal/kg), % Humidité, % Chlore, % Cendres : Ces champs sont entièrement modifiables, vous permettant de simuler l'impact d'un combustible de qualité différente de celle que vous avez habituellement."
            ]
        },
        {
            title: "2. Fonctionnalités de Scénarios",
            content: "La puissance de cet outil réside dans sa capacité à sauvegarder et recharger des configurations complètes.",
            points: [
                 "Sauvegarder le scénario : Une fois que vous avez configuré une recette de mélange (godets, analyses manuelles, débits), vous pouvez lui donner un nom et la sauvegarder. Cela enregistre un \"instantané\" de toute votre simulation.",
                 "Charger un scénario : Vous pouvez à tout moment recharger un scénario précédemment sauvegardé. Tous les champs seront alors automatiquement remplis avec les données de ce scénario, vous permettant de le ré-évaluer ou de le modifier.",
                 "Gestion des scénarios : Il est possible de renommer ou de supprimer des scénarios obsolètes pour maintenir votre liste de simulations propre et pertinente."
            ]
        },
        {
            title: "3. Indicateurs et Actions",
            points: [
                "Indicateurs Globaux : Comme pour le calculateur principal, un bandeau en haut de la page affiche en temps réel les caractéristiques consolidées de votre mélange simulé (PCI moyen, % Chlore, etc.).",
                "Réinitialiser : Un bouton vous permet d'effacer complètement la simulation en cours (tous les godets, analyses et débits) pour repartir d'une page blanche."
            ]
        },
        {
            title: "4. Isolation des Données",
            content: "Il est crucial de comprendre que cette page est un environnement complètement isolé. Les simulations que vous y effectuez n'ont **aucun impact** sur :",
            points: [
                 "L'historique des analyses de la page \"Résultats\".",
                 "Les sessions de mélange qui alimentent le \"Tableau de Bord\" ou le \"Rapport de Synthèse\".",
                 "Les données de stock ou de coût."
            ],
            conclusion: "C'est un véritable outil de laboratoire virtuel pour tester des idées sans risque."
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

        if(section.conclusion) {
            yPos += 4;
            const conclusionLines = doc.splitTextToSize(section.conclusion, page_width - margin * 2);
            for (const line of conclusionLines) {
                doc.text(line, margin, yPos);
                yPos += 6;
            }
        }
        yPos += 8;
    }

    doc.save(`Principe_Simulation_Melange_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Fonctionnement de la Simulation de Mélange", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page \"Simulation de Mélange\" est un environnement de test, souvent appelé \"bac à sable\". Elle est conçue pour permettre aux opérateurs de créer et d'évaluer des recettes de mélange de manière totalement libre et isolée, sans impacter les données de production réelles ou les analyses enregistrées."),
        new Paragraph("Son objectif principal est de pouvoir répondre rapidement à des questions hypothétiques comme : \"Que se passerait-il si je recevais un combustible avec tel PCI et telle humidité ?\" ou \"Comment puis-je ajuster ma recette si un de mes combustibles habituels n'est plus disponible ?\"."),

        new Paragraph({ text: "1. Principale Différence avec le \"Calcul de Mélange\"", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Contrairement à la page \"Calcul de Mélange\" qui utilise les analyses moyennes des combustibles stockées en base de données, la page de simulation vous donne le contrôle total. Pour chaque combustible, vous devez saisir manuellement toutes les caractéristiques :"),
        new Paragraph({ text: "Nombre de Godets : Comme dans le calculateur principal.", bullet: { level: 0 } }),
        new Paragraph({ text: "PCI (kcal/kg), % Humidité, % Chlore, % Cendres : Ces champs sont entièrement modifiables, vous permettant de simuler l'impact d'un combustible de qualité différente de celle que vous avez habituellement.", bullet: { level: 0 } }),

        new Paragraph({ text: "2. Fonctionnalités de Scénarios", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La puissance de cet outil réside dans sa capacité à sauvegarder et recharger des configurations complètes."),
        new Paragraph({ text: "Sauvegarder le scénario : Une fois que vous avez configuré une recette de mélange (godets, analyses manuelles, débits), vous pouvez lui donner un nom et la sauvegarder. Cela enregistre un \"instantané\" de toute votre simulation.", bullet: { level: 0 } }),
        new Paragraph({ text: "Charger un scénario : Vous pouvez à tout moment recharger un scénario précédemment sauvegardé. Tous les champs seront alors automatiquement remplis avec les données de ce scénario, vous permettant de le ré-évaluer ou de le modifier.", bullet: { level: 0 } }),
        new Paragraph({ text: "Gestion des scénarios : Il est possible de renommer ou de supprimer des scénarios obsolètes pour maintenir votre liste de simulations propre et pertinente.", bullet: { level: 0 } }),
        
        new Paragraph({ text: "3. Indicateurs et Actions", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph({ text: "Indicateurs Globaux : Comme pour le calculateur principal, un bandeau en haut de la page affiche en temps réel les caractéristiques consolidées de votre mélange simulé (PCI moyen, % Chlore, etc.).", bullet: { level: 0 } }),
        new Paragraph({ text: "Réinitialiser : Un bouton vous permet d'effacer complètement la simulation en cours (tous les godets, analyses et débits) pour repartir d'une page blanche.", bullet: { level: 0 } }),

        new Paragraph({ text: "4. Isolation des Données", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Il est crucial de comprendre que cette page est un environnement complètement isolé. Les simulations que vous y effectuez n'ont aucun impact sur :"),
        new Paragraph({ text: "L'historique des analyses de la page \"Résultats\".", bullet: { level: 0 } }),
        new Paragraph({ text: "Les sessions de mélange qui alimentent le \"Tableau de Bord\" ou le \"Rapport de Synthèse\".", bullet: { level: 0 } }),
        new Paragraph({ text: "Les données de stock ou de coût.", bullet: { level: 0 } }),
        new Paragraph({ text: "C'est un véritable outil de laboratoire virtuel pour tester des idées sans risque.", spacing: { before: 200 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Simulation_Melange_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <FlaskConical className="h-8 w-8 text-primary" />
          Fonctionnement de la Simulation de Mélange
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique comment utiliser l'environnement "bac à sable" pour tester librement des recettes de mélange.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Simulation de Mélange" est un environnement de test, souvent appelé "bac à sable". Elle est conçue pour permettre aux opérateurs de créer et d'évaluer des recettes de mélange de manière totalement libre et isolée, sans impacter les données de production réelles ou les analyses enregistrées.
          </p>
          <p>
            Son objectif principal est de pouvoir répondre rapidement à des questions hypothétiques comme : "Que se passerait-il si je recevais un combustible avec tel PCI et telle humidité ?" ou "Comment puis-je ajuster ma recette si un de mes combustibles habituels n'est plus disponible ?".
          </p>
          
          <h2>1. Principale Différence avec le "Calcul de Mélange"</h2>
          <p>
            Contrairement à la page "Calcul de Mélange" qui utilise les analyses moyennes des combustibles stockées en base de données, la page de simulation vous donne le contrôle total. Pour chaque combustible, vous devez saisir manuellement toutes les caractéristiques :
          </p>
          <ul>
            <li><strong>Nombre de Godets :</strong> Comme dans le calculateur principal.</li>
            <li><strong>PCI (kcal/kg), % Humidité, % Chlore, % Cendres :</strong> Ces champs sont entièrement modifiables, vous permettant de simuler l'impact d'un combustible de qualité différente de celle que vous avez habituellement.</li>
          </ul>

          <h2>2. Fonctionnalités de Scénarios</h2>
          <p>
            La puissance de cet outil réside dans sa capacité à sauvegarder et recharger des configurations complètes.
          </p>
          <ul>
            <li><strong>Sauvegarder le scénario :</strong> Une fois que vous avez configuré une recette de mélange (godets, analyses manuelles, débits), vous pouvez lui donner un nom et la sauvegarder. Cela enregistre un "instantané" de toute votre simulation.</li>
            <li><strong>Charger un scénario :</strong> Vous pouvez à tout moment recharger un scénario précédemment sauvegardé. Tous les champs seront alors automatiquement remplis avec les données de ce scénario, vous permettant de le ré-évaluer ou de le modifier.</li>
            <li><strong>Gestion des scénarios :</strong> Il est possible de renommer ou de supprimer des scénarios obsolètes pour maintenir votre liste de simulations propre et pertinente.</li>
          </ul>

          <h2>3. Indicateurs et Actions</h2>
          <ul>
            <li><strong>Indicateurs Globaux :</strong> Comme pour le calculateur principal, un bandeau en haut de la page affiche en temps réel les caractéristiques consolidées de votre mélange simulé (PCI moyen, % Chlore, etc.).</li>
            <li><strong>Réinitialiser :</strong> Un bouton vous permet d'effacer complètement la simulation en cours (tous les godets, analyses et débits) pour repartir d'une page blanche.</li>
          </ul>
          
          <h2>4. Isolation des Données</h2>
          <p>
            Il est crucial de comprendre que cette page est un environnement complètement isolé. Les simulations que vous y effectuez n'ont <strong>aucun impact</strong> sur :
          </p>
          <ul>
              <li>L'historique des analyses de la page "Résultats".</li>
              <li>Les sessions de mélange qui alimentent le "Tableau de Bord" ou le "Rapport de Synthèse".</li>
              <li>Les données de stock ou de coût.</li>
          </ul>
           <p className="font-semibold">C'est un véritable outil de laboratoire virtuel pour tester des idées sans risque.</p>
        </CardContent>
      </Card>
    </div>
  );
}
