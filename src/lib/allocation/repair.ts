import type { AllocWorkshop, Bundle, ParticipantAssignment } from "@/types/allocation";
import { bundleFits, commitBundle, releaseBundle, type UsageMap } from "@/lib/allocation/validate";
import { slotKey } from "@/lib/allocation/session-slots";

export interface RepairContext {
  workshopsById: Map<string, AllocWorkshop>;
  bundlesByParticipant: Map<string, Bundle[]>;
  assignments: Map<string, ParticipantAssignment>;
  usage: UsageMap;
}

const MAX_ROUNDS = 3;

/**
 * Versucht, unversorgte Teilnehmer nachtraeglich zu versorgen - zunaechst durch ihre
 * naechstbesten Buendel, danach durch begrenzte 2-opt-Swaps: ein bereits zugeteilter
 * Teilnehmer wird nur dann verdraengt, wenn er selbst vollstaendig auf ein anderes
 * gueltiges Buendel umgesetzt werden kann (Nettoeffekt: ein zusaetzlicher Teilnehmer
 * wird versorgt, niemand verliert seine Vollversorgung). Kapazitaet wird dabei nie
 * verletzt. Gibt die Liste der weiterhin unversorgten Teilnehmer-IDs zurueck.
 */
export function repairUnassigned(unassignedIds: string[], ctx: RepairContext): string[] {
  let remaining = [...unassignedIds];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let progressed = false;
    const next: string[] = [];

    for (const participantId of remaining) {
      const bundles = ctx.bundlesByParticipant.get(participantId) ?? [];
      if (tryAssignWithSwap(participantId, bundles, ctx)) {
        progressed = true;
      } else {
        next.push(participantId);
      }
    }

    remaining = next;
    if (!progressed) break;
  }

  return remaining;
}

function tryAssignWithSwap(participantId: string, bundles: Bundle[], ctx: RepairContext): boolean {
  for (const bundle of bundles) {
    if (bundleFits(bundle, ctx.usage, ctx.workshopsById)) {
      commit(participantId, bundle, ctx);
      return true;
    }

    const blockers = blockingWorkshopIds(bundle, ctx);
    if (blockers.length === 0) continue;

    const displaced = findDisplaceable(blockers, ctx);
    if (!displaced) continue;

    for (const d of displaced) releaseBundle(d.assignment, ctx.usage, ctx.workshopsById);

    if (!bundleFits(bundle, ctx.usage, ctx.workshopsById)) {
      for (const d of displaced) commitBundle(d.assignment, ctx.usage, ctx.workshopsById);
      continue;
    }

    const reassignments = new Map<string, Bundle>();
    let allReassigned = true;
    for (const d of displaced) {
      const alt = (ctx.bundlesByParticipant.get(d.participantId) ?? [])
        .filter((b) => !sameBundle(b, d.assignment))
        .find((b) => bundleFits(b, ctx.usage, ctx.workshopsById));
      if (!alt) {
        allReassigned = false;
        break;
      }
      commitBundle(alt, ctx.usage, ctx.workshopsById);
      reassignments.set(d.participantId, alt);
    }

    if (!allReassigned) {
      for (const [, b] of reassignments) releaseBundle(b, ctx.usage, ctx.workshopsById);
      for (const d of displaced) commitBundle(d.assignment, ctx.usage, ctx.workshopsById);
      continue;
    }

    commit(participantId, bundle, ctx);
    for (const d of displaced) {
      const alt = reassignments.get(d.participantId)!;
      commit(d.participantId, alt, ctx, false);
    }
    return true;
  }

  return false;
}

function blockingWorkshopIds(bundle: Bundle, ctx: RepairContext): string[] {
  return bundle.workshopIds.filter((id) => {
    const workshop = ctx.workshopsById.get(id);
    if (!workshop) return false;
    const key = slotKey(id, workshop.session, bundle.sessionAssignment);
    return (ctx.usage.get(key) ?? 0) >= workshop.capacity;
  });
}

function commit(
  participantId: string,
  bundle: Bundle,
  ctx: RepairContext,
  applyUsage = true
): void {
  if (applyUsage) commitBundle(bundle, ctx.usage, ctx.workshopsById);
  ctx.assignments.set(participantId, {
    participantId,
    workshopIds: bundle.workshopIds,
    score: bundle.score,
    sessionAssignment: bundle.sessionAssignment,
  });
}

function findDisplaceable(
  blockingWorkshopIds: string[],
  ctx: RepairContext
): Array<{ participantId: string; assignment: ParticipantAssignment }> | null {
  const result: Array<{ participantId: string; assignment: ParticipantAssignment }> = [];
  const used = new Set<string>();

  for (const workshopId of blockingWorkshopIds) {
    const candidate = [...ctx.assignments.entries()]
      .filter(([pid, a]) => a.workshopIds.includes(workshopId) && !used.has(pid))
      .sort((a, b) => a[1].score - b[1].score)[0];
    if (!candidate) return null;
    used.add(candidate[0]);
    result.push({ participantId: candidate[0], assignment: candidate[1] });
  }

  return result;
}

function sameBundle(a: Bundle, b: Bundle): boolean {
  return (
    a.workshopIds.length === b.workshopIds.length &&
    a.workshopIds.every((id) => b.workshopIds.includes(id))
  );
}
