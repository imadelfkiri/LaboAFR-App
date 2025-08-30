
'use server';
/**
 * @fileOverview Un agent IA pour l'optimisation des mélanges de combustibles.
 *
 * - optimizeMixture - Suggère une recette de mélange basée sur un objectif utilisateur.
 * - MixtureOptimizerInput - Le type d'entrée pour la fonction optimizeMixture.
 * - MixtureOptimizerOutput - Le type de retour pour la fonction optimizeMixture.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { AverageAnalysis } from '@/lib/data';

const RecipeSchema = z.record(z.string(), z.number().describe("Nombre de godets pour ce combustible."));

const MixtureOptimizerInputSchema = z.object({
  availableFuels: z.record(
    z.string(),
    z.object({
      pci_brut: z.number(),
      h2o: z.number(),
      chlore: z.number(),
      cendres: z.number(),
      density: z.number(),
      count: z.number(),
    })
  ).describe("Un objet où chaque clé est le nom d'un combustible et la valeur contient ses caractéristiques moyennes."),
  userObjective: z.string().describe("L'objectif de l'utilisateur pour le mélange. Ex: 'obtenir un PCI de 3500 avec un chlore bas'."),
});

export type MixtureOptimizerInput = z.infer<typeof MixtureOptimizerInputSchema>;

const MixtureOptimizerOutputSchema = z.object({
  reasoning: z.string().describe("Explication détaillée du raisonnement derrière la recette proposée."),
  recipe: z.object({
    hallAF: RecipeSchema.describe("Recette pour l'installation Hall des AF."),
    ats: RecipeSchema.describe("Recette pour l'installation ATS."),
  }).describe("La recette de mélange proposée."),
});

export type MixtureOptimizerOutput = z.infer<typeof MixtureOptimizerOutputSchema>;


const mixtureOptimizerPrompt = ai.definePrompt({
    name: 'mixtureOptimizerPrompt',
    input: { schema: MixtureOptimizerInputSchema },
    output: { schema: MixtureOptimizerOutputSchema },
    config: {
      response: {
        format: 'json',
      },
    },
    prompt: `Tu es un expert en optimisation de combustibles pour une cimenterie. Ton rôle est de proposer une recette de mélange (nombre de godets pour chaque combustible) pour deux installations (Hall des AF et ATS) afin d'atteindre un objectif précis défini par l'utilisateur.

    Voici les contraintes et les données disponibles :
    1.  Le volume d'un godet est fixé à 3 m³.
    2.  Le poids d'un combustible est calculé par : Poids (t) = Nombre de godets × 3 m³ × Densité (t/m³).
    3.  Les caractéristiques du mélange (PCI, Chlore, etc.) sont la moyenne des caractéristiques de chaque combustible, pondérée par leur poids respectif.
    4.  Tu dois fournir une recette pour les deux installations : "Hall des AF" et "ATS". Tu peux décider de n'utiliser qu'une seule installation si c'est plus pertinent.
    5.  Les valeurs de PCI sont en kcal/kg. Les autres valeurs (H2O, Chlore, Cendres) sont en %.

    DONNÉES DISPONIBLES :
    Voici les caractéristiques moyennes des combustibles disponibles :
    {{#each availableFuels}}
    - Combustible: {{@key}}
      - PCI moyen: {{this.pci_brut}} kcal/kg
      - Humidité moyenne: {{this.h2o}}%
      - Chlore moyen: {{this.chlore}}%
      - Cendres moyennes: {{this.cendres}}%
      - Densité moyenne: {{this.density}} t/m³
    {{/each}}

    OBJECTIF DE L'UTILISATEUR :
    "{{userObjective}}"

    TA MISSION :
    1.  **Raisonnement :** Explique clairement ta stratégie. Par exemple, comment tu comptes combiner les combustibles à haut et bas PCI, comment tu gères le chlore, etc. Sois concis mais précis.
    2.  **Recette :** Fournis une recette claire sous forme de nombre de godets pour chaque combustible dans chaque installation. Si un combustible n'est pas utilisé, ne l'inclus pas dans la recette pour cette installation. La recette doit être réaliste (utilise des nombres de godets entiers et raisonnables).

    Réponds uniquement au format JSON demandé.`,
});


const mixtureOptimizerFlow = ai.defineFlow(
  {
    name: 'mixtureOptimizerFlow',
    inputSchema: MixtureOptimizerInputSchema,
    outputSchema: MixtureOptimizerOutputSchema,
  },
  async (input) => {
    const { output } = await mixtureOptimizerPrompt(input);
    if (!output) {
      throw new Error("L'assistant IA n'a pas pu générer de suggestion.");
    }
    return output;
  }
);

export async function optimizeMixture(input: MixtureOptimizerInput): Promise<MixtureOptimizerOutput> {
    return mixtureOptimizerFlow(input);
}
