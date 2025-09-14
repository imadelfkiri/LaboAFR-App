'use server';
/**
 * @fileOverview Un agent IA pour interpréter l'impact des cendres sur la qualité du clinker.
 *
 * - interpretImpact - Analyse les variations entre un clinker avec et sans cendres.
 * - ImpactInterpreterInput - Le type d'entrée pour la fonction interpretImpact.
 * - ImpactInterpreterOutput - Le type de retour pour la fonction interpretImpact.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const OxideAnalysisSchema = z.object({
  pf: z.number().optional().nullable(),
  sio2: z.number().optional().nullable(),
  al2o3: z.number().optional().nullable(),
  fe2o3: z.number().optional().nullable(),
  cao: z.number().optional().nullable(),
  mgo: z.number().optional().nullable(),
  so3: z.number().optional().nullable(),
  k2o: z.number().optional().nullable(),
  tio2: z.number().optional().nullable(),
  mno: z.number().optional().nullable(),
  p2o5: z.number().optional().nullable(),
});

const ModulesSchema = z.object({
  ms: z.number().optional(),
  af: z.number().optional(),
  lsf: z.number().optional(),
});

export const ImpactInterpreterInputSchema = z.object({
  clinkerWithoutAsh: OxideAnalysisSchema,
  clinkerWithAsh: OxideAnalysisSchema,
  modulesSans: ModulesSchema,
  modulesAvec: ModulesSchema,
  c3sSans: z.number().optional().nullable(),
  c3sAvec: z.number().optional().nullable(),
});
export type ImpactInterpreterInput = z.infer<typeof ImpactInterpreterInputSchema>;

export const ImpactInterpreterOutputSchema = z.object({
  interpretation: z
    .string()
    .describe("Une analyse détaillée mais concise de l'impact des cendres. Commence par un résumé, puis détaille l'impact sur la cuisson, la qualité du clinker et les propriétés du ciment."),
});
export type ImpactInterpreterOutput = z.infer<typeof ImpactInterpreterOutputSchema>;

const impactInterpreterPrompt = ai.definePrompt({
  name: 'impactInterpreterPrompt',
  input: { schema: ImpactInterpreterInputSchema },
  output: { schema: ImpactInterpreterOutputSchema },
  prompt: `Tu es un expert en technologie du ciment. Ton rôle est d'analyser l'impact de l'incorporation de cendres de combustibles sur la composition et la qualité du clinker.

  Voici les données fournies :
  - Composition du clinker SANS cendres.
  - Composition du clinker AVEC cendres.

  DONNÉES :
  - Clinker SANS cendres :
    - Oxydes : {{JSON.stringify input.clinkerWithoutAsh}}
    - Modules : MS={{input.modulesSans.ms}}, AF={{input.modulesSans.af}}, LSF={{input.modulesSans.lsf}}
    - C3S : {{input.c3sSans}}
  - Clinker AVEC cendres :
    - Oxydes : {{JSON.stringify input.clinkerWithAsh}}
    - Modules : MS={{input.modulesAvec.ms}}, AF={{input.modulesAvec.af}}, LSF={{input.modulesAvec.lsf}}
    - C3S : {{input.c3sAvec}}

  TA MISSION :
  Fournis une interprétation claire et concise de l'impact des cendres en te basant sur la comparaison des deux compositions. Structure ta réponse comme suit (en français) :

  1.  **Résumé de l'Impact :** Commence par une phrase synthétique qui résume l'effet global (ex: "L'ajout de cendres semble améliorer la clinkérisabilité mais pourrait légèrement diminuer la réactivité à court terme.").

  2.  **Impact sur la Cuisson (Clinkérisabilité) :**
      *   Analyse la variation du LSF (Facteur de Saturation en Chaux). Une baisse du LSF facilite généralement la cuisson.
      *   Analyse la variation du MS (Module Siliceux). Un MS plus bas (autour de 2.5) favorise la formation de la phase liquide et améliore la cuisson.
      *   Analyse la variation du AF (Module Alumino-Ferrique). Un AF plus bas indique une plus grande quantité de phase liquide.

  3.  **Impact sur la Qualité du Clinker :**
      *   Analyse la variation du C3S (Alite). C'est le composant principal pour la résistance à court terme. Une baisse est généralement négative.
      *   Mentionne l'impact sur les autres phases si les données le permettent (C2S, C3A, C4AF), même si elles ne sont pas explicitement calculées. Par exemple, une baisse du LSF et du C3S suggère une augmentation du C2S (résistance à long terme).

  4.  **Conclusion et Recommandations :**
      *   Conclus sur l'acceptabilité de cet impact.
      *   Suggère brièvement une action corrective si nécessaire (ex: "Il pourrait être nécessaire d'ajuster le LSF du cru pour compenser la baisse du C3S.").

  Sois professionnel, technique mais compréhensible. Utilise des termes comme "clinkérisabilité", "phase liquide", "réactivité". Ne te contente pas de lister les changements de valeurs, mais EXPLIQUE leurs conséquences.`,
});

const impactInterpreterFlow = ai.defineFlow(
  {
    name: 'impactInterpreterFlow',
    inputSchema: ImpactInterpreterInputSchema,
    outputSchema: ImpactInterpreterOutputSchema,
  },
  async (input) => {
    const { output } = await impactInterpreterPrompt(input);
    if (!output) {
      throw new Error("L'assistant IA n'a pas pu générer d'interprétation.");
    }
    return output;
  }
);

export async function interpretImpact(input: ImpactInterpreterInput): Promise<ImpactInterpreterOutput> {
  return impactInterpreterFlow(input);
}
