'use server';

import { optimizeMixture } from "@/ai/flows/mixture-optimizer-flow";
import type { MixtureOptimizerInput, MixtureOptimizerOutput } from "@/ai/flows/mixture-optimizer-flow";
import { interpretImpact } from "@/ai/flows/impact-interpreter-flow";
import type { ImpactInterpreterInput, ImpactInterpreterOutput } from "@/ai/flows/impact-interpreter-flow";
import { getFunctions, httpsCallable } from "firebase/functions";
import { functions } from "./firebase";


export async function handleGenerateSuggestion(input: MixtureOptimizerInput): Promise<MixtureOptimizerOutput | null> {
    try {
      const result = await optimizeMixture(input);
      return result;
    } catch (error) {
      console.error('Server action error:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      // Re-throwing the error will propagate it to the client-side's catch block.
      // The client will see the generic "Error: An unknown error occurred." message.
      throw new Error(errorMessage);
    }
}

export async function handleInterpretImpact(input: ImpactInterpreterInput): Promise<ImpactInterpreterOutput | null> {
    try {
        const result = await interpretImpact(input);
        return result;
    } catch (error) {
        console.error('Server action error:', error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(errorMessage);
    }
}

export async function generateReportAction(reportData: any) {
  try {
    const callGenerate = httpsCallable(functions, 'generateAndSaveReport');
    const result = await callGenerate({ reportData });
    const { downloadUrl } = result.data as { downloadUrl: string };
    return { downloadUrl };
  } catch (error: any) {
    console.error("Cloud function error:", error);
    // Renvoyer un objet d'erreur sérialisable
    return { error: error.message || "Une erreur interne est survenue lors de la génération du rapport." };
  }
}
