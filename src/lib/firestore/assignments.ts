import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { allocate } from "@/lib/allocation/allocate";
import { allocateStrictFcfs } from "@/lib/allocation/allocate-fcfs";
import type { AllocParticipant, AllocWorkshop } from "@/types/allocation";
import type { AssignmentDoc, DraftAssignmentDoc, DraftMeta } from "@/types/assignment";
import { listRegistrations } from "@/lib/firestore/registrations";
import { getWorkshopsByIds, listWorkshops } from "@/lib/firestore/workshops";
import { chunk } from "@/lib/firestore/batch-utils";
import { updateRegistrationStatus } from "@/lib/firestore/participants";
import { getEventConfig } from "@/lib/firestore/event-config";
import { allowedSessionPairs, slotKey, type SessionAssignment } from "@/lib/allocation/session-slots";
import type { WorkshopDoc } from "@/types/workshop";

const DRAFT_COLLECTION = "draftAssignments";
const ASSIGNMENT_COLLECTION = "assignments";
const CONFIG_REF = adminDb.collection("event").doc("config");

export interface DraftSummary {
  assignedCount: number;
  waitlistedCount: number;
  conflictCount: number;
  generatedAt: number;
}

/** Berechnet einen frischen Zuteilungsvorschlag aus allen Anmeldungen und ersetzt den
 * bisherigen Entwurf vollstaendig. Nicht sichtbar fuer Teilnehmer bis zur Veroeffentlichung. */
export async function generateDraftAllocation(): Promise<DraftSummary> {
  const [registrations, workshops, config] = await Promise.all([
    listRegistrations(),
    listWorkshops(),
    getEventConfig(),
  ]);

  const participants: AllocParticipant[] = registrations.map((r) => ({
    participantId: r.participantId,
    preferences: r.preferences,
    submittedAt: r.submittedAt,
  }));
  const allocWorkshops: AllocWorkshop[] = workshops.map((w) => ({
    id: w.id,
    durationMinutes: w.durationMinutes,
    session: w.session,
    capacity: w.capacity,
  }));

  const result =
    config.allocationMode === "strict-fcfs"
      ? allocateStrictFcfs(participants, allocWorkshops)
      : allocate(participants, allocWorkshops);

  const existingDraft = await adminDb.collection(DRAFT_COLLECTION).get();
  for (const docs of chunk(existingDraft.docs, 400)) {
    const batch = adminDb.batch();
    docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  for (const docs of chunk(result.assigned, 400)) {
    const batch = adminDb.batch();
    for (const a of docs) {
      const doc: DraftAssignmentDoc = {
        participantId: a.participantId,
        workshopIds: a.workshopIds,
        score: a.score,
        sessionAssignment: a.sessionAssignment,
      };
      batch.set(adminDb.collection(DRAFT_COLLECTION).doc(a.participantId), doc);
    }
    await batch.commit();
  }

  const generatedAt = Date.now();
  const draftMeta: DraftMeta = {
    waitlisted: result.waitlisted,
    conflicts: result.conflicts,
    generatedAt,
  };
  await CONFIG_REF.set({ draftMeta }, { merge: true });

  return {
    assignedCount: result.assigned.length,
    waitlistedCount: result.waitlisted.length,
    conflictCount: result.conflicts.length,
    generatedAt,
  };
}

export async function listDraftAssignments(): Promise<DraftAssignmentDoc[]> {
  const snap = await adminDb.collection(DRAFT_COLLECTION).get();
  return snap.docs.map((d) => d.data() as DraftAssignmentDoc);
}

/** Manuelle Admin-Aenderung einer Zuteilung im Entwurf - validiert Workshop-Typ,
 * Session-Kombination und verbleibende Kapazitaet (unter Ausschluss der eigenen
 * bisherigen Belegung des Teilnehmers) neu. */
export async function updateDraftAssignment(participantId: string, workshopIds: string[]): Promise<void> {
  const workshops = await getWorkshopsByIds(workshopIds);
  if (workshops.length !== workshopIds.length) {
    throw new Error("Mindestens ein Workshop wurde nicht gefunden.");
  }

  let sessionAssignment: SessionAssignment | undefined;

  if (workshopIds.length === 1) {
    if (workshops[0].durationMinutes !== 120) {
      throw new Error("Eine einzelne Zuteilung ist nur fuer 120-Minuten-Workshops gueltig.");
    }
  } else if (workshopIds.length === 2) {
    if (workshops.some((w) => w.durationMinutes !== 60)) {
      throw new Error("Zwei Zuteilungen sind nur fuer je 60-Minuten-Workshops gueltig.");
    }
    const [wa, wb] = workshops;
    const pairs = allowedSessionPairs(wa.session as 1 | 2 | "both", wb.session as 1 | 2 | "both");
    if (pairs.length === 0) {
      throw new Error("Beide Workshops liegen in derselben Session.");
    }
    // Bei "both"-Workshops waehlt die erste gueltige Kombination die Session - eine
    // manuelle Session-Auswahl bietet die Admin-Oberflaeche fuer diesen Sonderfall
    // bewusst nicht an (seltener Ausnahmefall der manuellen Zuteilungs-Korrektur).
    const [sessionA, sessionB] = pairs[0];
    const assignment: SessionAssignment = {};
    if (wa.session === "both") assignment[wa.id] = sessionA;
    if (wb.session === "both") assignment[wb.id] = sessionB;
    if (Object.keys(assignment).length > 0) sessionAssignment = assignment;
  } else {
    throw new Error("Ungueltige Anzahl an Workshops (erlaubt: 1x120min oder 2x60min).");
  }

  const draftSnap = await adminDb.collection(DRAFT_COLLECTION).get();
  const workshopsById = new Map<string, WorkshopDoc>(workshops.map((w) => [w.id, w]));
  const usage = new Map<string, number>();
  for (const d of draftSnap.docs) {
    if (d.id === participantId) continue;
    const data = d.data() as DraftAssignmentDoc;
    for (const id of data.workshopIds) {
      const w = workshopsById.get(id);
      const key = slotKey(id, w?.session ?? null, data.sessionAssignment);
      usage.set(key, (usage.get(key) ?? 0) + 1);
    }
  }
  for (const w of workshops) {
    const key = slotKey(w.id, w.session, sessionAssignment);
    if ((usage.get(key) ?? 0) >= w.capacity) {
      const sessionLabel = w.session === "both" ? ` (Session ${sessionAssignment?.[w.id]})` : "";
      throw new Error(`Workshop "${w.title}"${sessionLabel} hat keine freie Kapazitaet mehr.`);
    }
  }

  const doc: DraftAssignmentDoc = { participantId, workshopIds, score: 0, sessionAssignment };
  await adminDb.collection(DRAFT_COLLECTION).doc(participantId).set(doc);
}

export async function removeDraftAssignment(participantId: string): Promise<void> {
  await adminDb.collection(DRAFT_COLLECTION).doc(participantId).delete();
}

/** Kopiert den geprueften Entwurf in die finale, fuer Teilnehmer sichtbare Zuteilung. */
export async function publishAssignments(): Promise<{ publishedCount: number }> {
  const [draftSnap, workshops] = await Promise.all([
    adminDb.collection(DRAFT_COLLECTION).get(),
    listWorkshops(),
  ]);
  const workshopsById = new Map(workshops.map((w) => [w.id, w]));
  const publishedAt = Date.now();

  for (const docs of chunk(draftSnap.docs, 400)) {
    const batch = adminDb.batch();
    for (const d of docs) {
      const data = d.data() as DraftAssignmentDoc;
      const [session1WorkshopId, session2WorkshopId] = resolveSessions(
        data.workshopIds,
        workshopsById,
        data.sessionAssignment
      );
      const doc: AssignmentDoc = {
        participantId: data.participantId,
        workshopIds: data.workshopIds,
        session1WorkshopId,
        session2WorkshopId,
        status: "published",
        publishedAt,
      };
      batch.set(adminDb.collection(ASSIGNMENT_COLLECTION).doc(data.participantId), doc);
    }
    await batch.commit();
  }

  for (const docs of chunk(draftSnap.docs, 400)) {
    await Promise.all(
      docs.map((d) => updateRegistrationStatus(d.id, "assigned"))
    );
  }

  await CONFIG_REF.set({ assignmentPublished: true, publishedAt }, { merge: true });
  return { publishedCount: draftSnap.size };
}

function resolveSessions(
  workshopIds: string[],
  workshopsById: Map<string, { durationMinutes: 60 | 120; session: 1 | 2 | "both" | null }>,
  sessionAssignment?: SessionAssignment
): [string | null, string | null] {
  if (workshopIds.length === 1) {
    const w = workshopsById.get(workshopIds[0]);
    if (w?.durationMinutes === 120) return [workshopIds[0], workshopIds[0]];
    return [workshopIds[0], null];
  }
  const [a, b] = workshopIds;
  const wa = workshopsById.get(a);
  const sessionOfA = wa?.session === "both" ? sessionAssignment?.[a] : wa?.session;
  if (sessionOfA === 1) return [a, b];
  if (sessionOfA === 2) return [b, a];
  return [a, b];
}

export async function getFinalAssignment(participantId: string): Promise<AssignmentDoc | null> {
  const snap = await adminDb.collection(ASSIGNMENT_COLLECTION).doc(participantId).get();
  if (!snap.exists) return null;
  return snap.data() as AssignmentDoc;
}

export async function listFinalAssignments(): Promise<AssignmentDoc[]> {
  const snap = await adminDb.collection(ASSIGNMENT_COLLECTION).get();
  return snap.docs.map((d) => d.data() as AssignmentDoc);
}

export async function removeFinalAssignment(participantId: string): Promise<void> {
  await adminDb.collection(ASSIGNMENT_COLLECTION).doc(participantId).delete();
}
