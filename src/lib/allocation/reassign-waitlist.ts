import type { AllocParticipant, AllocWorkshop, ParticipantAssignment } from "@/types/allocation";
import type { AllocationMode } from "@/types/assignment";
import { enumerateBundles } from "@/lib/allocation/bundles";
import { bundleFits, commitBundle, type UsageMap } from "@/lib/allocation/validate";

export interface ReassignWaitlistResult {
  assigned: ParticipantAssignment[];
  stillWaitlisted: string[];
}

/**
 * Rueckt wartende Teilnehmer in frei gewordene Kapazitaet nach (z.B. nachdem ein
 * Teilnehmer krankheitsbedingt storniert wurde). Bewusst OHNE Swap-Repair: anders als
 * `allocate()` darf diese Funktion NIEMALS bereits bestaetigte Teilnehmer antasten oder
 * verdraengen - sie befuellt nur mit der aktuellen Kapazitaet (`usage`, spiegelt die
 * schon bestaetigten Buchungen wider) noch freie Plaetze rein additiv.
 *
 * "fair": Kandidaten (Teilnehmer, Buendel) nach Score absteigend, `submittedAt`
 * (=Wartelisten-Reihenfolge) nur als Tiebreak - wie die Greedy-Phase von allocate().
 * "strict-fcfs": Teilnehmer strikt nach `submittedAt` (Wartelisten-Position), jeweils
 * bestbewertetes eigenes Buendel zuerst - wie allocate-fcfs.ts.
 */
export function reassignWaitlist(
  waitlisted: AllocParticipant[],
  workshops: AllocWorkshop[],
  usage: UsageMap,
  mode: AllocationMode
): ReassignWaitlistResult {
  const workshopsById = new Map(workshops.map((w) => [w.id, w]));
  const assigned = new Map<string, ParticipantAssignment>();

  if (mode === "strict-fcfs") {
    const sorted = [...waitlisted].sort((a, b) => a.submittedAt - b.submittedAt);
    for (const p of sorted) {
      const bundles = enumerateBundles(p, workshopsById);
      const fitting = bundles.find((b) => bundleFits(b, usage, workshopsById));
      if (fitting) {
        commitBundle(fitting, usage, workshopsById);
        assigned.set(p.participantId, {
          participantId: p.participantId,
          workshopIds: fitting.workshopIds,
          score: fitting.score,
          sessionAssignment: fitting.sessionAssignment,
        });
      }
    }
  } else {
    const candidates = waitlisted
      .flatMap((p) =>
        enumerateBundles(p, workshopsById).map((bundle) => ({
          participantId: p.participantId,
          submittedAt: p.submittedAt,
          bundle,
        }))
      )
      .sort((a, b) => b.bundle.score - a.bundle.score || a.submittedAt - b.submittedAt);

    for (const candidate of candidates) {
      if (assigned.has(candidate.participantId)) continue;
      if (bundleFits(candidate.bundle, usage, workshopsById)) {
        commitBundle(candidate.bundle, usage, workshopsById);
        assigned.set(candidate.participantId, {
          participantId: candidate.participantId,
          workshopIds: candidate.bundle.workshopIds,
          score: candidate.bundle.score,
          sessionAssignment: candidate.bundle.sessionAssignment,
        });
      }
    }
  }

  const stillWaitlisted = waitlisted
    .map((p) => p.participantId)
    .filter((id) => !assigned.has(id));

  return { assigned: [...assigned.values()], stillWaitlisted };
}
