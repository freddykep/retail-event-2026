import type { AllocParticipant, AllocWorkshop, Bundle } from "@/types/allocation";
import { preferenceScore } from "@/lib/allocation/scoring";
import { allowedSessionPairs, type SessionAssignment } from "@/lib/allocation/session-slots";

/**
 * Ermittelt alle gueltigen Workshop-Buendel, die sich aus den Praeferenzen eines
 * Teilnehmers bilden lassen, sortiert nach Score absteigend (beste zuerst). Es gibt
 * keinen vorab gewaehlten "Track" - die Praeferenzliste kann 60- und
 * 120-Minuten-Workshops frei mischen (z.B. "liebster Wunsch: ausgebuchter
 * 2-Stunden-Workshop, alternativ: zwei 1-Stunden-Workshops"):
 *
 * - Jede 120-Minuten-Praeferenz ist fuer sich ein eigenstaendiges Buendel.
 * - Jedes ungeordnete Paar zweier 60-Minuten-Praeferenzen in unterschiedlichen
 *   Sessions ist ein Buendel (die eigentliche Gueltigkeitsregel - der Teilnehmer
 *   kennt die Sessions nicht, das System ermittelt die beste Kombination).
 */
export function enumerateBundles(
  participant: AllocParticipant,
  workshopsById: Map<string, AllocWorkshop>
): Bundle[] {
  const prefs = participant.preferences
    .map((id, index) => ({ id, index, workshop: workshopsById.get(id) }))
    .filter((p): p is { id: string; index: number; workshop: AllocWorkshop } =>
      Boolean(p.workshop)
    );

  const bundles: Bundle[] = [];

  for (const p of prefs) {
    if (p.workshop.durationMinutes === 120) {
      bundles.push({ workshopIds: [p.id], score: preferenceScore(p.index) });
    }
  }

  const sixty = prefs.filter((p) => p.workshop.durationMinutes === 60);
  for (let i = 0; i < sixty.length; i++) {
    for (let j = i + 1; j < sixty.length; j++) {
      const a = sixty[i];
      const b = sixty[j];
      if (a.workshop.session === null || b.workshop.session === null) continue;

      const pairs = allowedSessionPairs(a.workshop.session, b.workshop.session);
      for (const [sessionA, sessionB] of pairs) {
        const sessionAssignment: SessionAssignment = {};
        if (a.workshop.session === "both") sessionAssignment[a.id] = sessionA;
        if (b.workshop.session === "both") sessionAssignment[b.id] = sessionB;

        bundles.push({
          workshopIds: [a.id, b.id],
          score: preferenceScore(a.index) + preferenceScore(b.index),
          sessionAssignment: Object.keys(sessionAssignment).length ? sessionAssignment : undefined,
        });
      }
    }
  }

  return bundles.sort((a, b) => b.score - a.score);
}
