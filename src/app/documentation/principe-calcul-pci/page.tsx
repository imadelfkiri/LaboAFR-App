import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Flame } from "lucide-react";
import type { Metadata } from 'next';
import { ExportButton } from "@/components/actions/ExportButton";

export const metadata: Metadata = {
  title: "Principe du Calculateur PCI | FuelTrack AFR",
  description: "Explication détaillée de la page du Calculateur PCI : fonctionnement, champs, calculs et fonctionnalités.",
};

export default function PrincipeCalculPCIPage() {

  const handleExport = () => {
    // La logique d'exportation sera implémentée ici
    alert("La fonctionnalité d'exportation sera bientôt disponible.");
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
