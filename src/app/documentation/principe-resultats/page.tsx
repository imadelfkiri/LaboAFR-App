"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FlaskConical } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export default function PrincipeResultatsPage() {

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement de la Page Résultats", page_width / 2, yPos, { align: "center" });
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
      "La page \"Résultats\" est la mémoire vivante de toutes les analyses de combustibles effectuées. Elle centralise chaque enregistrement pour permettre une consultation, une analyse et une gestion efficaces des données historiques.",
      "L'objectif est de fournir une vue d'ensemble complète et interactive de la qualité des combustibles reçus, avec des outils puissants pour filtrer, trier et exporter les informations."
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
            title: "1. La Barre d'Outils : Filtrage et Actions",
            content: "Située en haut du tableau, cette barre regroupe les fonctionnalités clés pour manipuler les données.",
            points: [
                "Statistiques Rapides : Affiche en temps réel le nombre total d'analyses dans votre sélection, ainsi que le nombre de résultats 'Conformes' et 'Non-Conformes' par rapport aux spécifications définies.",
                "Filtres Combinables : Vous pouvez affiner votre recherche en combinant plusieurs filtres : par Type de Combustible, par Fournisseur, et par Période (grâce à un sélecteur de date).",
                "Importer : Permet de charger en masse des analyses depuis un fichier Excel (.xlsx, .xls), évitant la saisie manuelle.",
                "Exporter : Offre la possibilité de télécharger la sélection de données actuelle aux formats PDF ou Excel, avec des options pour des rapports détaillés ou agrégés.",
                "Supprimer Tout : Une action critique (protégée par une confirmation) qui permet de vider complètement la base de données des résultats. À utiliser avec une extrême prudence."
            ]
        },
        {
            title: "2. Le Tableau des Résultats",
            content: "Le tableau principal affiche toutes les analyses correspondant à vos filtres. Il est conçu pour être à la fois dense en informations et facile à lire.",
            points: [
                 "Tri des Colonnes : Chaque en-tête de colonne est cliquable pour trier les données (par date, par type de combustible, par valeur de PCI, etc.) de manière ascendante ou descendante.",
                 "Indicateurs de Conformité : La colonne 'Alertes' utilise des icônes (coche verte, triangle rouge) pour indiquer en un coup d'œil si une analyse est conforme aux spécifications. Le survol de l'icône 'Non Conforme' détaille la ou les raisons de l'alerte (ex: 'PCI bas', 'H2O élevé').",
                 "Données Clés : Affiche toutes les valeurs importantes : date, combustible, fournisseur, tonnage, PCS, PCI, H2O, Chlore, et Cendres.",
                 "Moyennes de la Sélection : Une ligne spéciale en bas du tableau calcule et affiche en temps réel la moyenne des valeurs numériques pour la sélection de données actuellement affichée."
            ]
        },
        {
            title: "3. Actions sur les Lignes",
            content: "Chaque enregistrement peut être géré individuellement directement depuis le tableau.",
            points: [
                "Modifier : Ouvre une fenêtre modale qui vous permet de corriger ou de compléter les valeurs d'une analyse déjà enregistrée.",
                "Supprimer : Permet de supprimer une ligne spécifique de la base de données (après une demande de confirmation pour éviter les erreurs)."
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

    doc.save(`Principe_Page_Resultats_${date.replaceAll('/', '-')}.pdf`);
  };

  const handleExportWord = () => {
    const children = [
        new Paragraph({ text: "Fonctionnement de la Page Résultats", heading: HeadingLevel.TITLE, alignment: "center" }),
        new Paragraph({ text: `Document généré le ${format(new Date(), "dd/MM/yyyy")}`, alignment: "center", spacing: { after: 400 } }),
        
        new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("La page \"Résultats\" est la mémoire vivante de toutes les analyses de combustibles effectuées. Elle centralise chaque enregistrement pour permettre une consultation, une analyse et une gestion efficaces des données historiques."),
        new Paragraph("L'objectif est de fournir une vue d'ensemble complète et interactive de la qualité des combustibles reçus, avec des outils puissants pour filtrer, trier et exporter les informations."),

        new Paragraph({ text: "1. La Barre d'Outils : Filtrage et Actions", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Située en haut du tableau, cette barre regroupe les fonctionnalités clés pour manipuler les données."),
        new Paragraph({ text: "Statistiques Rapides : Affiche en temps réel le nombre total d'analyses dans votre sélection, ainsi que le nombre de résultats 'Conformes' et 'Non-Conformes' par rapport aux spécifications définies.", bullet: { level: 0 } }),
        new Paragraph({ text: "Filtres Combinables : Vous pouvez affiner votre recherche en combinant plusieurs filtres : par Type de Combustible, par Fournisseur, et par Période (grâce à un sélecteur de date).", bullet: { level: 0 } }),
        new Paragraph({ text: "Importer : Permet de charger en masse des analyses depuis un fichier Excel (.xlsx, .xls), évitant la saisie manuelle.", bullet: { level: 0 } }),
        new Paragraph({ text: "Exporter : Offre la possibilité de télécharger la sélection de données actuelle aux formats PDF ou Excel, avec des options pour des rapports détaillés ou agrégés.", bullet: { level: 0 } }),
        new Paragraph({ text: "Supprimer Tout : Une action critique (protégée par une confirmation) qui permet de vider complètement la base de données des résultats. À utiliser avec une extrême prudence.", bullet: { level: 0 } }),

        new Paragraph({ text: "2. Le Tableau des Résultats", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Le tableau principal affiche toutes les analyses correspondant à vos filtres. Il est conçu pour être à la fois dense en informations et facile à lire."),
        new Paragraph({ text: "Tri des Colonnes : Chaque en-tête de colonne est cliquable pour trier les données (par date, par type de combustible, par valeur de PCI, etc.) de manière ascendante ou descendante.", bullet: { level: 0 } }),
        new Paragraph({ text: "Indicateurs de Conformité : La colonne 'Alertes' utilise des icônes (coche verte, triangle rouge) pour indiquer en un coup d'œil si une analyse est conforme aux spécifications. Le survol de l'icône 'Non Conforme' détaille la ou les raisons de l'alerte (ex: 'PCI bas', 'H2O élevé').", bullet: { level: 0 } }),
        new Paragraph({ text: "Données Clés : Affiche toutes les valeurs importantes : date, combustible, fournisseur, tonnage, PCS, PCI, H2O, Chlore, et Cendres.", bullet: { level: 0 } }),
        new Paragraph({ text: "Moyennes de la Sélection : Une ligne spéciale en bas du tableau calcule et affiche en temps réel la moyenne des valeurs numériques pour la sélection de données actuellement affichée.", bullet: { level: 0 } }),
        
        new Paragraph({ text: "3. Actions sur les Lignes", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        new Paragraph("Chaque enregistrement peut être géré individuellement directement depuis le tableau."),
        new Paragraph({ text: "Modifier : Ouvre une fenêtre modale qui vous permet de corriger ou de compléter les valeurs d'une analyse déjà enregistrée.", bullet: { level: 0 } }),
        new Paragraph({ text: "Supprimer : Permet de supprimer une ligne spécifique de la base de données (après une demande de confirmation pour éviter les erreurs).", bullet: { level: 0 } }),
    ];
    const doc = new Document({
      sections: [{ children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Principe_Page_Resultats_${format(new Date(), "yyyy-MM-dd")}.docx`);
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <FlaskConical className="h-8 w-8 text-primary" />
          Fonctionnement de la Page Résultats
        </CardTitle>
        <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-h3:text-emerald-400 prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique comment consulter, filtrer, trier et gérer l'historique de toutes les analyses de combustibles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Résultats" est la mémoire vivante de toutes les analyses de combustibles effectuées. Elle centralise chaque enregistrement pour permettre une consultation, une analyse et une gestion efficaces des données historiques.
          </p>
          <p>
            L'objectif est de fournir une vue d'ensemble complète et interactive de la qualité des combustibles reçus, avec des outils puissants pour filtrer, trier et exporter les informations.
          </p>
          
          <h2>1. La Barre d'Outils : Filtrage et Actions</h2>
          <p>
            Située en haut du tableau, cette barre regroupe les fonctionnalités clés pour manipuler les données.
          </p>
          <ul>
            <li><strong>Statistiques Rapides :</strong> Affiche en temps réel le nombre total d'analyses dans votre sélection, ainsi que le nombre de résultats 'Conformes' et 'Non-Conformes' par rapport aux spécifications définies.</li>
            <li><strong>Filtres Combinables :</strong> Vous pouvez affiner votre recherche en combinant plusieurs filtres : par Type de Combustible, par Fournisseur, et par Période (grâce à un sélecteur de date).</li>
            <li><strong>Importer :</strong> Permet de charger en masse des analyses depuis un fichier Excel (.xlsx, .xls), évitant la saisie manuelle.</li>
            <li><strong>Exporter :</strong> Offre la possibilité de télécharger la sélection de données actuelle aux formats PDF ou Excel, avec des options pour des rapports détaillés ou agrégés.</li>
            <li><strong>Supprimer Tout :</strong> Une action critique (protégée par une confirmation) qui permet de vider complètement la base de données des résultats. À utiliser avec une extrême prudence.</li>
          </ul>

          <h2>2. Le Tableau des Résultats</h2>
          <p>
            Le tableau principal affiche toutes les analyses correspondant à vos filtres. Il est conçu pour être à la fois dense en informations et facile à lire.
          </p>
          <ul>
            <li><strong>Tri des Colonnes :</strong> Chaque en-tête de colonne est cliquable pour trier les données (par date, par type de combustible, par valeur de PCI, etc.) de manière ascendante ou descendante.</li>
            <li><strong>Indicateurs de Conformité :</strong> La colonne 'Alertes' utilise des icônes (coche verte, triangle rouge) pour indiquer en un coup d'œil si une analyse est conforme aux spécifications. Le survol de l'icône 'Non Conforme' détaille la ou les raisons de l'alerte (ex: 'PCI bas', 'H2O élevé').</li>
            <li><strong>Données Clés :</strong> Affiche toutes les valeurs importantes : date, combustible, fournisseur, tonnage, PCS, PCI, H2O, Chlore, et Cendres.</li>
            <li><strong>Moyennes de la Sélection :</strong> Une ligne spéciale en bas du tableau calcule et affiche en temps réel la moyenne des valeurs numériques pour la sélection de données actuellement affichée.</li>
          </ul>
          
          <h2>3. Actions sur les Lignes</h2>
          <p>
            Chaque enregistrement peut être géré individuellement directement depuis le tableau.
          </p>
          <ul>
              <li><strong>Modifier :</strong> Ouvre une fenêtre modale qui vous permet de corriger ou de compléter les valeurs d'une analyse déjà enregistrée.</li>
              <li><strong>Supprimer :</strong> Permet de supprimer une ligne spécifique de la base de données (après une demande de confirmation pour éviter les erreurs).</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
