import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { enumerateBundles } from "@/lib/allocation/bundles";
import type { AllocParticipant, AllocWorkshop, Bundle } from "@/types/allocation";
import type {
  RegistrationDoc,
  RegistrationSubmitInput,
  WaitlistEntryDoc,
} from "@/types/registration";
import { updateRegistrationStatus } from "@/lib/firestore/participants";

const REGISTRATIONS = "registrations";
const WORKSHOPS = "workshops";
const WAITLIST = "waitlistEntries";

export interface SubmitResult {
  status: "confirmed" | "waitlisted";
  workshopIds: string[];
}

/**
 * Echtzeit-Buchung bei Absenden der Praeferenzen (First-Come-First-Served,
 * race-condition-sicher via Firestore-Transaktion). Reserviert atomar das
 * bestbewertete verfuegbare Buendel oder setzt den Teilnehmer auf die Warteliste.
 * Editiert ein Teilnehmer seine Angaben spaeter erneut, bleibt `submittedAt`
 * unveraendert (FCFS-Zeitpunkt der ERSTEN gueltigen Anmeldung).
 */
export async function submitRegistration(
  participantId: string,
  input: RegistrationSubmitInput
): Promise<SubmitResult> {
  const result = await adminDb.runTransaction<SubmitResult>(async (tx) => {
    const regRef = adminDb.collection(REGISTRATIONS).doc(participantId);
    const waitlistRef = adminDb.collection(WAITLIST).doc(participantId);
    const configRef = adminDb.collection("event").doc("config");

    const [regSnap, waitlistSnap, configSnap] = await Promise.all([
      tx.get(regRef),
      tx.get(waitlistRef),
      tx.get(configRef),
    ]);

    const existingReg = regSnap.exists ? (regSnap.data() as RegistrationDoc) : null;
    const existingWaitlist = waitlistSnap.exists ? (waitlistSnap.data() as WaitlistEntryDoc) : null;
    const oldConfirmedIds = existingReg?.status === "confirmed" ? existingReg.confirmedWorkshopIds : [];
    const oldSessionAssignment =
      existingReg?.status === "confirmed" ? existingReg.confirmedSessionAssignment : undefined;

    // Alle Workshops laden, die entweder neu gewuenscht ODER aktuell bestaetigt sind
    // (letztere werden ggf. wieder freigegeben).
    const workshopIds = [...new Set([...input.preferences, ...oldConfirmedIds])];
    const workshopSnaps = await Promise.all(
      workshopIds.map((id) => tx.get(adminDb.collection(WORKSHOPS).doc(id)))
    );

    const workshopsById = new Map<string, AllocWorkshop>();
    const rawById = new Map<
      string,
      { confirmedCount: number; session1ConfirmedCount: number; session2ConfirmedCount: number }
    >();
    for (const snap of workshopSnaps) {
      if (!snap.exists) throw new Error(`Workshop ${snap.id} wurde nicht gefunden.`);
      const data = snap.data()!;
      workshopsById.set(snap.id, {
        id: snap.id,
        durationMinutes: data.durationMinutes,
        session: data.session ?? null,
        capacity: data.capacity,
      });
      rawById.set(snap.id, {
        confirmedCount: data.confirmedCount ?? 0,
        session1ConfirmedCount: data.session1ConfirmedCount ?? 0,
        session2ConfirmedCount: data.session2ConfirmedCount ?? 0,
      });
    }

    const submittedAt = existingReg?.submittedAt ?? Date.now();
    const allocParticipant: AllocParticipant = {
      participantId,
      preferences: input.preferences,
      submittedAt,
    };

    const bundles = enumerateBundles(allocParticipant, workshopsById);
    if (bundles.length === 0) {
      throw new Error("Aus den gewaehlten Workshops laesst sich keine gueltige Kombination bilden.");
    }

    // Effektive Belegung eines Buendel-Slots unter Ausschluss der EIGENEN bisherigen
    // Reservierung (damit ein erneutes Absenden/Aendern nicht an sich selbst scheitert).
    // Bei "both"-Workshops zaehlt nur die fuer DIESES Kandidaten-Buendel gewaehlte
    // Session, nicht die jeweils andere.
    const effectiveUsage = (id: string, bundle: Bundle): number => {
      const workshop = workshopsById.get(id)!;
      const raw = rawById.get(id)!;
      if (workshop.session === "both") {
        const session = bundle.sessionAssignment?.[id];
        const own = session === 1 ? raw.session1ConfirmedCount : raw.session2ConfirmedCount;
        const ownWasHere = oldConfirmedIds.includes(id) && oldSessionAssignment?.[id] === session;
        return own - (ownWasHere ? 1 : 0);
      }
      return raw.confirmedCount - (oldConfirmedIds.includes(id) ? 1 : 0);
    };

    const fittingBundle = bundles.find((b) =>
      b.workshopIds.every((id) => effectiveUsage(id, b) < workshopsById.get(id)!.capacity)
    );

    const now = Date.now();

    // Pro betroffenem Workshop einen einzigen konsistenten Delta-Update-Aufruf bauen
    // (statt separater Release-/Reserve-Aufrufe), damit ein Session-Wechsel bei
    // gleichbleibendem "both"-Workshop nicht durch zwei sich ueberschreibende
    // Schreibvorgaenge in derselben Transaktion verlorengeht.
    const affectedIds = new Set([...oldConfirmedIds, ...(fittingBundle?.workshopIds ?? [])]);
    for (const id of affectedIds) {
      const workshop = workshopsById.get(id)!;
      const raw = rawById.get(id)!;
      const wasOld = oldConfirmedIds.includes(id);
      const isNew = fittingBundle?.workshopIds.includes(id) ?? false;
      const oldSession = workshop.session === "both" ? oldSessionAssignment?.[id] : undefined;
      const newSession = workshop.session === "both" ? fittingBundle?.sessionAssignment?.[id] : undefined;

      let confirmedDelta = 0;
      let session1Delta = 0;
      let session2Delta = 0;
      if (wasOld && !isNew) {
        confirmedDelta -= 1;
        if (oldSession === 1) session1Delta -= 1;
        else if (oldSession === 2) session2Delta -= 1;
      }
      if (!wasOld && isNew) {
        confirmedDelta += 1;
        if (newSession === 1) session1Delta += 1;
        else if (newSession === 2) session2Delta += 1;
      }
      if (wasOld && isNew && workshop.session === "both" && oldSession !== newSession) {
        if (oldSession === 1) session1Delta -= 1;
        else if (oldSession === 2) session2Delta -= 1;
        if (newSession === 1) session1Delta += 1;
        else if (newSession === 2) session2Delta += 1;
      }

      if (confirmedDelta === 0 && session1Delta === 0 && session2Delta === 0) continue;
      const update: Record<string, number> = {};
      if (confirmedDelta !== 0) update.confirmedCount = raw.confirmedCount + confirmedDelta;
      if (session1Delta !== 0) update.session1ConfirmedCount = raw.session1ConfirmedCount + session1Delta;
      if (session2Delta !== 0) update.session2ConfirmedCount = raw.session2ConfirmedCount + session2Delta;
      tx.update(adminDb.collection(WORKSHOPS).doc(id), update);
    }

    if (fittingBundle) {
      const doc: RegistrationDoc = {
        participantId,
        preferences: input.preferences,
        submittedAt,
        updatedAt: now,
        status: "confirmed",
        confirmedWorkshopIds: fittingBundle.workshopIds,
        confirmedSessionAssignment: fittingBundle.sessionAssignment,
      };
      tx.set(regRef, doc);
      if (existingWaitlist) tx.delete(waitlistRef);

      return { status: "confirmed", workshopIds: fittingBundle.workshopIds };
    }

    // Keine Kombination passt -> gesamtes Buendel als Einheit auf die Warteliste.
    const desiredBundle = bundles[0];
    let position = existingWaitlist?.position;
    let createdAt = existingWaitlist?.createdAt;
    if (position === undefined || createdAt === undefined) {
      const nextPosition = ((configSnap.data()?.nextWaitlistPosition as number | undefined) ?? 0) + 1;
      tx.set(configRef, { nextWaitlistPosition: nextPosition }, { merge: true });
      position = nextPosition;
      createdAt = now;
    }

    const waitlistDoc: WaitlistEntryDoc = {
      participantId,
      workshopIds: desiredBundle.workshopIds,
      position,
      createdAt,
    };
    tx.set(waitlistRef, waitlistDoc);

    const doc: RegistrationDoc = {
      participantId,
      preferences: input.preferences,
      submittedAt,
      updatedAt: now,
      status: "waitlisted",
      confirmedWorkshopIds: [],
    };
    tx.set(regRef, doc);

    return { status: "waitlisted", workshopIds: desiredBundle.workshopIds };
  });

  // "assigned" bedeutet hier: vorlaeufig reserviert (Echtzeitbuchung) - nicht die
  // finale, nach Admin-Pruefung veroeffentlichte Zuteilung.
  await updateRegistrationStatus(participantId, result.status === "confirmed" ? "assigned" : "waitlisted");

  return result;
}

export async function getRegistration(participantId: string): Promise<RegistrationDoc | null> {
  const snap = await adminDb.collection(REGISTRATIONS).doc(participantId).get();
  if (!snap.exists) return null;
  return snap.data() as RegistrationDoc;
}

export async function listRegistrations(): Promise<RegistrationDoc[]> {
  const snap = await adminDb.collection(REGISTRATIONS).get();
  return snap.docs.map((d) => d.data() as RegistrationDoc);
}
