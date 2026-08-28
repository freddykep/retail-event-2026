import type { AllocParticipant, AllocWorkshop, AllocationResult } from "@/types/allocation";
import { enumerateBundles } from "@/lib/allocation/bundles";
import { bundleFits, commitBundle, initialUsage } from "@/lib/allocation/validate";

/**
 * Striktes First-Come-First-Served: Teilnehmer werden ausschliesslich in der
 * Reihenfolge ihres `submittedAt` verarbeitet - wer zuerst kommt, bekommt sein
 * bestbewertetes verfuegbares Buendel (aus den EIGENEN Praeferenzen), und diese
 * Zuteilung wird durch niemanden mehr angetastet. Anders als bei `allocate()`
 * (siehe dort) gibt es bewusst KEINEN Swap-Repair-Pass - das ist per Definition der
 * Unterschied zwischen "hartem" FCFS und der fairen, score-basierten Zuteilung mit
 * Ausgleich. Beide Modi sind ueber `event/config.allocationMode` admin-waehlbar
 * (siehe lib/firestore/assignments.ts).
 *
 * Wie bei `allocate()` sind Buendel immer atomar - ein Teilnehmer bekommt entweder
 * sein komplettes gewuenschtes Buendel oder landet komplett auf der Warteliste,
 * nie nur einen Teil davon.
 */
export function allocateStrictFcfs(
  participants: AllocParticipant[],
  workshops: AllocWorkshop[]
): AllocationResult {
  const workshopsById = new Map(workshops.map((w) => [w.id, w]));
  const usage = initialUsage(workshops);
  const sorted = [...participants].sort((a, b) => a.submittedAt - b.submittedAt);

  const assigned: AllocationResult["assigned"] = [];
  const waitlisted: AllocationResult["waitlisted"] = [];
  const conflicts: string[] = [];

  for (const p of sorted) {
    const bundles = enumerateBundles(p, workshopsById);
    if (bundles.length === 0) {
      conflicts.push(p.participantId);
      continue;
    }

    const fitting = bundles.find((b) => bundleFits(b, usage, workshopsById));
    if (fitting) {
      commitBundle(fitting, usage, workshopsById);
      assigned.push({
        participantId: p.participantId,
        workshopIds: fitting.workshopIds,
        score: fitting.score,
        sessionAssignment: fitting.sessionAssignment,
      });
    } else {
      waitlisted.push({ participantId: p.participantId, workshopIds: bundles[0].workshopIds });
    }
  }

  return { assigned, waitlisted, conflicts };
}
