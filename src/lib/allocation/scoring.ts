import { PREFERENCE_SCORES } from "@/types/allocation";

/** Punktzahl fuer eine Praeferenz an Rang `index` (0-basiert). */
export function preferenceScore(index: number): number {
  return PREFERENCE_SCORES[index] ?? 0;
}
