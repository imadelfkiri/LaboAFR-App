"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import { format } from 'date-fns';

export default function PrincipeCalculPCIPage() {

  const handleExport = () => {
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy");
    let yPos = 20;
    const page_width = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Fonctionnement du Calculateur PCI", page_width / 2, yPos, { align: "center" });
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
    const introText = "La page \"Calculateur PCI\" est un outil central de l'application. Elle a deux objectifs principaux :";
    const introLines = doc.splitTextToSize(introText, page_width - margin * 2);
    for (const line of introLines) {
        doc.text(line, margin, yPos);
        yPos += 6;
    }
    yPos += 4;
    
    const objectives = [
        "Calculer le Pouvoir Calorifique Inférieur (PCI) sur produit brut à partir du Pouvoir Calorifique Supérieur (PCS) sur sec et du taux d'humidité.",
        "Enregistrer les résultats d'analyse d'un échantillon de combustible (arrivage, prospection, etc.) dans la base de données."
    ];
    for (const obj of objectives) {
        const lines = doc.splitTextToSize(obj, page_width - margin * 2 - 10);
        doc.text("•", margin + 5, yPos);
        for (const line of lines) {
            doc.text(line, margin + 10, yPos);
            yPos += 6;
        }
        yPos+=2;
    }
    yPos += 4;

    const conclusionIntro = "Elle est conçue pour être à la fois un outil de calcul rapide et le formulaire de saisie principal pour l'historique des analyses.";
    const conclusionLines = doc.splitTextToSize(conclusionIntro, page_width - margin * 2);
    for (const line of conclusionLines) {
        doc.text(line, margin, yPos);
        yPos += 6;
    }
    yPos += 10;
    
    // Sections
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Description des Sections et des Champs", margin, yPos);
    yPos += 8;

    const sections = [
        {
            title: "1. Informations Générales",
            content: "Cette section regroupe les informations d'identification de l'échantillon analysé.",
            points: [
                "Date : La date de l'analyse ou de l'arrivage du combustible.",
                "Type d'analyse : Catégorise l'analyse (ex: Arrivage, Prospection, Consommation).",
                "Combustible : Le type de combustible analysé. La liste est alimentée par la base de données centrale. Un bouton \"Nouveau combustible...\" permet d'ajouter un nouveau type à la volée s'il n'existe pas.",
                "Fournisseur : Le fournisseur du combustible. La liste est filtrée en fonction du combustible sélectionné. Un bouton \"Ajouter un fournisseur\" apparaît pour associer un nouveau fournisseur au combustible choisi.",
                "Tonnage (t) : Le poids en tonnes du lot de combustible reçu (principalement pour les arrivages).",
                "Remarques : Un champ libre pour ajouter des informations contextuelles sur l'analyse."
            ]
        },
        {
            title: "2. Données Analytiques",
            content: "Cette section contient les valeurs mesurées en laboratoire.",
            points: [
                "PCS (kcal/kg) : Le Pouvoir Calorifique Supérieur sur produit sec. C'est une valeur clé pour le calcul.",
                "% H₂O : Le taux d'humidité du produit brut. Indispensable pour le calcul du PCI.",
                "% H : La teneur en hydrogène du combustible. Cette valeur n'est pas saisie manuellement ; elle est automatiquement récupérée depuis les \"Données de Référence des Combustibles\" en fonction du combustible sélectionné. Elle est cruciale pour la précision du calcul.",
                "% Cl- et % Cendres : Les teneurs en chlore et en cendres. Ces valeurs sont importantes pour le suivi de la qualité et pour le calcul d'impact sur le clinker, mais n'entrent pas dans le calcul du PCI.",
                "Taux d'inertes (%) : Permet de corriger le PCS si le combustible contient une part de matériaux non combustibles (ex: métaux). Le PCS utilisé pour le calcul sera diminué de ce pourcentage."
            ]
        },
        {
            title: "3. Résultat du Calcul",
            content: "Le résultat du PCI sur Brut est affiché en grand. Il est mis à jour en temps réel à chaque modification des champs PCS, % H₂O, % H ou Taux d'inertes."
        },
        {
            title: "Calcul du PCI",
            content: "Le calcul du PCI sur brut (pci_brut) est effectué à l'aide de la formule suivante, qui prend en compte l'énergie perdue pour évaporer l'humidité présente dans le combustible et l'eau formée par la combustion de l'hydrogène :",
            isFormula: true,
            formula: "pci_brut = ((PCS - 50.635 * H) * (1 - H₂O/100)) - (H₂O * 5.83)",
            formulaDesc: "Où :\n• PCS : La valeur que vous saisissez, corrigée par le taux d'inertes.\n• H : La teneur en hydrogène récupérée automatiquement.\n• H₂O : Le taux d'humidité que vous saisissez."
        },
        {
            title: "Fonctionnalités Clés",
            points: [
                 "Validation par Couleur : Les champs de saisie (% H₂O, % Cl-, % Cendres) et le résultat du PCI changent de couleur (vert, rouge) pour vous indiquer si la valeur est conforme ou non aux spécifications définies pour le couple combustible-fournisseur sélectionné.",
                 "Bouton \"Enregistrer\" : Ce bouton, situé en bas à droite, enregistre l'ensemble des informations et le résultat du PCI calculé dans la collection \"resultats\", alimentant ainsi l'historique et les pages de statistiques.",
                 "Importation de Fichiers Excel : Sur la page \"Résultats des Analyses\", un bouton \"Importer\" permet de charger en masse des analyses depuis un fichier Excel, évitant ainsi la saisie manuelle."
            ]
        }
    ];

    for (const section of sections) {
        if (yPos > 260) { doc.addPage(); yPos = 20; }
        doc.setFontSize(section.isFormula ? 14 : 12);
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

        if(section.isFormula && section.formula) {
            doc.setFillColor(230, 230, 230); // light gray
            doc.rect(margin, yPos - 2, page_width - margin*2, 12, 'F');
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "normal");
            doc.text(section.formula, page_width / 2, yPos + 5, { align: "center" });
            doc.setTextColor(0); // reset color
            yPos += 18;

            if(section.formulaDesc) {
                 doc.setFont("helvetica", "normal");
                 const descLines = section.formulaDesc.split('\n');
                 for (const descLine of descLines) {
                     const lines = doc.splitTextToSize(descLine, page_width - margin * 2);
                     for (const line of lines) {
                        doc.text(line, margin, yPos);
                        yPos += 6;
                     }
                 }
                yPos += 4;
            }
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
        yPos += 5;
    }

    doc.save(`Principe_Calcul_PCI_${date.replaceAll('/', '-')}.pdf`);
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
          <Flame className="h-8 w-8 text-primary" />
          Fonctionnement du Calculateur PCI
        </CardTitle>
        <ExportButton onClick={handleExport} />
      </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-h3:text-emerald-400 prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Cette page explique le fonctionnement, les champs, les calculs et les fonctionnalités de l'outil de calcul du PCI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2>Introduction</h2>
          <p>
            La page "Calculateur PCI" est un outil central de l'application. Elle a deux objectifs principaux :
          </p>
          <ol>
            <li><strong>Calculer le Pouvoir Calorifique Inférieur (PCI)</strong> sur produit brut à partir du Pouvoir Calorifique Supérieur (PCS) sur sec et du taux d'humidité.</li>
            <li><strong>Enregistrer les résultats d'analyse</strong> d'un échantillon de combustible (arrivage, prospection, etc.) dans la base de données.</li>
          </ol>
          <p>
            Elle est conçue pour être à la fois un outil de calcul rapide et le formulaire de saisie principal pour l'historique des analyses.
          </p>

          <h2>Description des Sections et des Champs</h2>
          
          <h3>1. Informations Générales</h3>
          <p>
            Cette section regroupe les informations d'identification de l'échantillon analysé.
          </p>
          <ul>
            <li><strong>Date :</strong> La date de l'analyse ou de l'arrivage du combustible.</li>
            <li><strong>Type d'analyse :</strong> Catégorise l'analyse (ex: Arrivage, Prospection, Consommation).</li>
            <li><strong>Combustible :</strong> Le type de combustible analysé. La liste est alimentée par la base de données centrale. Un bouton <strong>"Nouveau combustible..."</strong> permet d'ajouter un nouveau type à la volée s'il n'existe pas.</li>
            <li><strong>Fournisseur :</strong> Le fournisseur du combustible. La liste est filtrée en fonction du combustible sélectionné. Un bouton <strong>"Ajouter un fournisseur"</strong> apparaît pour associer un nouveau fournisseur au combustible choisi.</li>
            <li><strong>Tonnage (t) :</strong> Le poids en tonnes du lot de combustible reçu (principalement pour les arrivages).</li>
            <li><strong>Remarques :</strong> Un champ libre pour ajouter des informations contextuelles sur l'analyse.</li>
          </ul>

          <h3>2. Données Analytiques</h3>
          <p>
            Cette section contient les valeurs mesurées en laboratoire.
          </p>
          <ul>
            <li><strong>PCS (kcal/kg) :</strong> Le Pouvoir Calorifique Supérieur sur produit sec. C'est une valeur clé pour le calcul.</li>
            <li><strong>% H₂O :</strong> Le taux d'humidité du produit brut. Indispensable pour le calcul du PCI.</li>
            <li><strong>% H :</strong> La teneur en hydrogène du combustible. Cette valeur n'est pas saisie manuellement ; elle est <strong>automatiquement récupérée</strong> depuis les "Données de Référence des Combustibles" en fonction du combustible sélectionné. Elle est cruciale pour la précision du calcul.</li>
            <li><strong>% Cl- et % Cendres :</strong> Les teneurs en chlore et en cendres. Ces valeurs sont importantes pour le suivi de la qualité et pour le calcul d'impact sur le clinker, mais n'entrent pas dans le calcul du PCI.</li>
            <li><strong>Taux d'inertes (%) :</strong> Permet de corriger le PCS si le combustible contient une part de matériaux non combustibles (ex: métaux). Le PCS utilisé pour le calcul sera diminué de ce pourcentage.</li>
          </ul>

          <h3>3. Résultat du Calcul</h3>
          <p>
            Le résultat du <strong>PCI sur Brut</strong> est affiché en grand. Il est mis à jour en temps réel à chaque modification des champs PCS, % H₂O, % H ou Taux d'inertes.
          </p>

          <h2>Calcul du PCI</h2>
          <p>
            Le calcul du PCI sur brut (<code>pci_brut</code>) est effectué à l'aide de la formule suivante, qui prend en compte l'énergie perdue pour évaporer l'humidité présente dans le combustible et l'eau formée par la combustion de l'hydrogène :
          </p>
          <div className="not-prose my-6">
              <pre className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 text-sm text-center font-mono text-emerald-300">
                  <code>pci_brut = ((PCS - 50.635 * H) * (1 - H₂O/100)) - (H₂O * 5.83)</code>
              </pre>
          </div>
          <p>
            Où :
          </p>
          <ul>
            <li><strong>PCS :</strong> La valeur que vous saisissez, corrigée par le taux d'inertes.</li>
            <li><strong>H :</strong> La teneur en hydrogène récupérée automatiquement.</li>
            <li><strong>H₂O :</strong> Le taux d'humidité que vous saisissez.</li>
          </ul>
          
          <h2>Fonctionnalités Clés</h2>
          <ul>
            <li><strong>Validation par Couleur :</strong> Les champs de saisie (% H₂O, % Cl-, % Cendres) et le résultat du PCI changent de couleur (vert, rouge) pour vous indiquer si la valeur est conforme ou non aux <strong>spécifications</strong> définies pour le couple combustible-fournisseur sélectionné.</li>
            <li><strong>Bouton "Enregistrer" :</strong> Ce bouton, situé en bas à droite, enregistre l'ensemble des informations et le résultat du PCI calculé dans la collection "resultats", alimentant ainsi l'historique et les pages de statistiques.</li>
            <li><strong>Importation de Fichiers Excel :</strong> Sur la page "Résultats des Analyses", un bouton "Importer" permet de charger en masse des analyses depuis un fichier Excel, évitant ainsi la saisie manuelle.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
