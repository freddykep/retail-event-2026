import type {
  AllocParticipant,
  AllocWorkshop,
  AllocationResult,
  Bundle,
  ParticipantAssignment,
} from "@/types/allocation";
import { enumerateBundles } from "@/lib/allocation/bundles";
import { bundleFits, commitBundle, initialUsage } from "@/lib/allocation/validate";
import { repairUnassigned } from "@/lib/allocation/repair";

interface Candidate {
  participantId: string;
  submittedAt: number;
  bundle: Bundle;
}

/**
 * Berechnet einen Zuteilungsvorschlag fuer alle Teilnehmer.
 *
 * 1. Greedy-Pass ueber alle (Teilnehmer, Buendel)-Kandidaten, sortiert nach Score
 *    absteigend; `submittedAt` (First-Come-First-Served) dient nur als Tiebreak bei
 *    gleichem Score/gleicher Knappheit - nicht als primaeres Sortierkriterium. So
 *    koennen spaetere Teilnehmer mit verfuegbaren Wuenschen fruehere Teilnehmer mit
 *    ueberlaufenen Wuenschen ueberholen.
 * 2. Swap-Repair-Pass: versucht, moeglichst viele der nach Schritt 1 unversorgten
 *    Teilnehmer durch Umverteilung zusaetzlich vollstaendig zu versorgen (siehe
 *    lib/allocation/repair.ts), statt sie vorschnell auf die Warteliste zu setzen.
 * 3. Verbleibend Unversorgte landen in FCFS-Reihenfolge auf der Warteliste.
 *
 * Bewusst kein Gale-Shapley (optimiert Stabilitaet, nicht Gesamtzufriedenheit/
 * Vollversorgung) und keine ILP-Loesung (fuer die Eventgroesse ueberdimensioniert
 * und schwerer nachvollziehbar). Reine Funktion, keine Firestore-Abhaengigkeit.
 */
export function allocate(
  participants: AllocParticipant[],
  workshops: AllocWorkshop[]
): AllocationResult {
  const workshopsById = new Map(workshops.map((w) => [w.id, w]));
  const usage = initialUsage(workshops);

  const bundlesByParticipant = new Map<string, Bundle[]>();
  const conflicts: string[] = [];
  for (const p of participants) {
    const bundles = enumerateBundles(p, workshopsById);
    bundlesByParticipant.set(p.participantId, bundles);
    if (bundles.length === 0) conflicts.push(p.participantId);
  }

  const candidates: Candidate[] = participants
    .filter((p) => !conflicts.includes(p.participantId))
    .flatMap((p) =>
      (bundlesByParticipant.get(p.participantId) ?? []).map((bundle) => ({
        participantId: p.participantId,
        submittedAt: p.submittedAt,
        bundle,
      }))
    )
    .sort((a, b) => b.bundle.score - a.bundle.score || a.submittedAt - b.submittedAt);

  const assignments = new Map<string, ParticipantAssignment>();
  for (const candidate of candidates) {
    if (assignments.has(candidate.participantId)) continue;
    if (bundleFits(candidate.bundle, usage, workshopsById)) {
      commitBundle(candidate.bundle, usage, workshopsById);
      assignments.set(candidate.participantId, {
        participantId: candidate.participantId,
        workshopIds: candidate.bundle.workshopIds,
        score: candidate.bundle.score,
        sessionAssignment: candidate.bundle.sessionAssignment,
      });
    }
  }

  const unassignedAfterGreedy = participants
    .map((p) => p.participantId)
    .filter((id) => !assignments.has(id) && !conflicts.includes(id));

  const stillUnassigned = repairUnassigned(unassignedAfterGreedy, {
    workshopsById,
    bundlesByParticipant,
    assignments,
    usage,
  });

  const participantsById = new Map(participants.map((p) => [p.participantId, p]));
  const waitlisted = stillUnassigned
    .map((id) => participantsById.get(id))
    .filter((p): p is AllocParticipant => Boolean(p))
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .map((p) => ({
      participantId: p.participantId,
      workshopIds: bundlesByParticipant.get(p.participantId)?.[0]?.workshopIds ?? [],
    }));

  return {
    assigned: [...assignments.values()],
    waitlisted,
    conflicts,
  };
}
