import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { enumerateBundles } from "@/lib/allocation/bundles";
import { reassignWaitlist } from "@/lib/allocation/reassign-waitlist";
import { allowedSessionPairs, type SessionAssignment } from "@/lib/allocation/session-slots";
import type { UsageMap } from "@/lib/allocation/validate";
import type { AllocParticipant, AllocWorkshop, Bundle } from "@/types/allocation";
import type { AllocationMode } from "@/types/assignment";
import type {
  RegistrationDoc,
  RegistrationSubmitInput,
  WaitlistEntryDoc,
} from "@/types/registration";
import { updateRegistrationStatus } from "@/lib/firestore/participants";
import type { WorkshopDoc } from "@/types/workshop";

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

/**
 * Storniert die Anmeldung eines Teilnehmers (z.B. krankheitsbedingter Ausfall):
 * gibt eine bestaetigte Buchung inkl. der jeweiligen Session-Kapazitaet wieder frei
 * und entfernt Registrierung/Wartelisteneintrag vollstaendig. Der Teilnehmer kann
 * sich danach reguelaer neu anmelden (neuer FCFS-Zeitstempel).
 */
export async function cancelRegistration(participantId: string): Promise<void> {
  await adminDb.runTransaction(async (tx) => {
    const regRef = adminDb.collection(REGISTRATIONS).doc(participantId);
    const waitlistRef = adminDb.collection(WAITLIST).doc(participantId);
    const regSnap = await tx.get(regRef);
    if (!regSnap.exists) return;

    const reg = regSnap.data() as RegistrationDoc;
    if (reg.status === "confirmed" && reg.confirmedWorkshopIds.length > 0) {
      const workshopSnaps = await Promise.all(
        reg.confirmedWorkshopIds.map((id) => tx.get(adminDb.collection(WORKSHOPS).doc(id)))
      );
      for (const snap of workshopSnaps) {
        if (!snap.exists) continue;
        const data = snap.data()!;
        const update: Record<string, number> = { confirmedCount: (data.confirmedCount ?? 1) - 1 };
        if (data.session === "both") {
          const session = reg.confirmedSessionAssignment?.[snap.id];
          if (session === 1) update.session1ConfirmedCount = (data.session1ConfirmedCount ?? 1) - 1;
          else if (session === 2) update.session2ConfirmedCount = (data.session2ConfirmedCount ?? 1) - 1;
        }
        tx.update(adminDb.collection(WORKSHOPS).doc(snap.id), update);
      }
    }

    tx.delete(regRef);
    tx.delete(waitlistRef);
  });

  await updateRegistrationStatus(participantId, "not_registered");
}

export interface ReassignSummary {
  promotedCount: number;
  stillWaitlistedCount: number;
}

/**
 * Rueckt wartende Teilnehmer in zwischenzeitlich frei gewordene Kapazitaet nach (z.B.
 * nach einer Stornierung). Nutzt den nebenwirkungsfreien Nachrueck-Algorithmus
 * (lib/allocation/reassign-waitlist.ts) - bereits bestaetigte Teilnehmer werden dabei
 * garantiert nie veraendert oder verdraengt, es wird nur additiv aufgefuellt.
 * Reihenfolge/Gewichtung folgt dem aktuell eingestellten Zuteilungsmodus
 * (event/config.allocationMode).
 */
export async function reassignWaitlistedParticipants(): Promise<ReassignSummary> {
  const configSnap = await adminDb.collection("event").doc("config").get();
  const mode: AllocationMode = configSnap.data()?.allocationMode ?? "fair";

  const result = await adminDb.runTransaction<ReassignSummary & { promotedIds: string[] }>(
    async (tx) => {
      const waitlistSnap = await tx.get(adminDb.collection(WAITLIST));
      const waitlistEntries = waitlistSnap.docs.map((d) => d.data() as WaitlistEntryDoc);
      if (waitlistEntries.length === 0) {
        return { promotedCount: 0, stillWaitlistedCount: 0, promotedIds: [] };
      }

      const regSnaps = await Promise.all(
        waitlistEntries.map((w) => tx.get(adminDb.collection(REGISTRATIONS).doc(w.participantId)))
      );
      const registrations = new Map<string, RegistrationDoc>();
      regSnaps.forEach((snap) => {
        if (snap.exists) registrations.set(snap.id, snap.data() as RegistrationDoc);
      });

      const workshopsSnap = await tx.get(adminDb.collection(WORKSHOPS));
      const workshopsById = new Map<string, AllocWorkshop>();
      const rawById = new Map<
        string,
        { confirmedCount: number; session1ConfirmedCount: number; session2ConfirmedCount: number }
      >();
      for (const doc of workshopsSnap.docs) {
        const data = doc.data();
        workshopsById.set(doc.id, {
          id: doc.id,
          durationMinutes: data.durationMinutes,
          session: data.session ?? null,
          capacity: data.capacity,
        });
        rawById.set(doc.id, {
          confirmedCount: data.confirmedCount ?? 0,
          session1ConfirmedCount: data.session1ConfirmedCount ?? 0,
          session2ConfirmedCount: data.session2ConfirmedCount ?? 0,
        });
      }

      const usage: UsageMap = new Map();
      for (const [id, workshop] of workshopsById) {
        const raw = rawById.get(id)!;
        if (workshop.session === "both") {
          usage.set(`${id}:1`, raw.session1ConfirmedCount);
          usage.set(`${id}:2`, raw.session2ConfirmedCount);
        } else {
          usage.set(id, raw.confirmedCount);
        }
      }

      const waitlistedParticipants: AllocParticipant[] = waitlistEntries
        .map((w) => {
          const reg = registrations.get(w.participantId);
          return reg
            ? { participantId: w.participantId, preferences: reg.preferences, submittedAt: reg.submittedAt }
            : null;
        })
        .filter((p): p is AllocParticipant => Boolean(p));

      const { assigned } = reassignWaitlist(waitlistedParticipants, [...workshopsById.values()], usage, mode);

      const now = Date.now();
      const confirmedDeltaById = new Map<string, number>();
      const session1DeltaById = new Map<string, number>();
      const session2DeltaById = new Map<string, number>();

      for (const a of assigned) {
        const reg = registrations.get(a.participantId)!;
        const doc: RegistrationDoc = {
          participantId: a.participantId,
          preferences: reg.preferences,
          submittedAt: reg.submittedAt,
          updatedAt: now,
          status: "confirmed",
          confirmedWorkshopIds: a.workshopIds,
          confirmedSessionAssignment: a.sessionAssignment,
        };
        tx.set(adminDb.collection(REGISTRATIONS).doc(a.participantId), doc);
        tx.delete(adminDb.collection(WAITLIST).doc(a.participantId));

        for (const id of a.workshopIds) {
          confirmedDeltaById.set(id, (confirmedDeltaById.get(id) ?? 0) + 1);
          const workshop = workshopsById.get(id)!;
          if (workshop.session === "both") {
            const session = a.sessionAssignment?.[id];
            if (session === 1) session1DeltaById.set(id, (session1DeltaById.get(id) ?? 0) + 1);
            else if (session === 2) session2DeltaById.set(id, (session2DeltaById.get(id) ?? 0) + 1);
          }
        }
      }

      // Pro Workshop EIN konsolidierter Delta-Schreibvorgang - falls mehrere neu
      // zugeteilte Teilnehmer denselben Workshop treffen, damit sich die Updates nicht
      // gegenseitig ueberschreiben (gleiches Prinzip wie in submitRegistration).
      for (const [id, delta] of confirmedDeltaById) {
        const raw = rawById.get(id)!;
        const update: Record<string, number> = { confirmedCount: raw.confirmedCount + delta };
        const s1 = session1DeltaById.get(id);
        const s2 = session2DeltaById.get(id);
        if (s1) update.session1ConfirmedCount = raw.session1ConfirmedCount + s1;
        if (s2) update.session2ConfirmedCount = raw.session2ConfirmedCount + s2;
        tx.update(adminDb.collection(WORKSHOPS).doc(id), update);
      }

      return {
        promotedCount: assigned.length,
        stillWaitlistedCount: waitlistedParticipants.length - assigned.length,
        promotedIds: assigned.map((a) => a.participantId),
      };
    }
  );

  await Promise.all(result.promotedIds.map((id) => updateRegistrationStatus(id, "assigned")));

  return { promotedCount: result.promotedCount, stillWaitlistedCount: result.stillWaitlistedCount };
}

/**
 * Admin-Override: weist einem EINZELNEN wartenden Teilnehmer manuell ein bestimmtes
 * Buendel zu (unabhaengig von seinen urspruenglichen Praeferenzen) - z.B. wenn der
 * Admin gezielt jemand anderen als den automatischen Algorithmus nachruecken lassen
 * moechte. Prueft Workshop-Typ, Session-Kombination und aktuelle Kapazitaet neu.
 */
export async function manuallyAssignFromWaitlist(
  participantId: string,
  workshopIds: string[]
): Promise<{ error?: string }> {
  const result = await adminDb.runTransaction<{ error?: string }>(async (tx) => {
    const regRef = adminDb.collection(REGISTRATIONS).doc(participantId);
    const waitlistRef = adminDb.collection(WAITLIST).doc(participantId);
    const regSnap = await tx.get(regRef);
    if (!regSnap.exists) return { error: "Keine Anmeldung gefunden." };
    const reg = regSnap.data() as RegistrationDoc;
    if (reg.status !== "waitlisted") {
      return { error: "Dieser Teilnehmer steht nicht (mehr) auf der Warteliste." };
    }

    const workshopSnaps = await Promise.all(
      workshopIds.map((id) => tx.get(adminDb.collection(WORKSHOPS).doc(id)))
    );
    if (workshopSnaps.some((s) => !s.exists)) {
      return { error: "Mindestens ein Workshop wurde nicht gefunden." };
    }
    const workshops = workshopSnaps.map((s) => ({ ...(s.data() as WorkshopDoc), id: s.id }));

    let sessionAssignment: SessionAssignment | undefined;
    if (workshopIds.length === 1) {
      if (workshops[0].durationMinutes !== 120) {
        return { error: "Eine einzelne Zuteilung ist nur fuer 120-Minuten-Workshops gueltig." };
      }
    } else if (workshopIds.length === 2) {
      if (workshops.some((w) => w.durationMinutes !== 60)) {
        return { error: "Zwei Zuteilungen sind nur fuer je 60-Minuten-Workshops gueltig." };
      }
      const [wa, wb] = workshops;
      const pairs = allowedSessionPairs(wa.session as 1 | 2 | "both", wb.session as 1 | 2 | "both");
      if (pairs.length === 0) {
        return { error: "Beide Workshops liegen in derselben Session." };
      }
      const [sessionA, sessionB] = pairs[0];
      const assignment: SessionAssignment = {};
      if (wa.session === "both") assignment[wa.id] = sessionA;
      if (wb.session === "both") assignment[wb.id] = sessionB;
      if (Object.keys(assignment).length > 0) sessionAssignment = assignment;
    } else {
      return { error: "Ungueltige Anzahl an Workshops (erlaubt: 1x120min oder 2x60min)." };
    }

    for (const w of workshops) {
      const used =
        w.session === "both"
          ? sessionAssignment?.[w.id] === 1
            ? (w.session1ConfirmedCount ?? 0)
            : (w.session2ConfirmedCount ?? 0)
          : (w.confirmedCount ?? 0);
      if (used >= w.capacity) {
        return { error: `Workshop "${w.title}" hat keine freie Kapazitaet mehr.` };
      }
    }

    const now = Date.now();
    tx.set(regRef, {
      participantId,
      preferences: reg.preferences,
      submittedAt: reg.submittedAt,
      updatedAt: now,
      status: "confirmed",
      confirmedWorkshopIds: workshopIds,
      confirmedSessionAssignment: sessionAssignment,
    } satisfies RegistrationDoc);
    tx.delete(waitlistRef);

    for (const w of workshops) {
      const update: Record<string, number> = { confirmedCount: (w.confirmedCount ?? 0) + 1 };
      if (w.session === "both") {
        const session = sessionAssignment?.[w.id];
        if (session === 1) update.session1ConfirmedCount = (w.session1ConfirmedCount ?? 0) + 1;
        else if (session === 2) update.session2ConfirmedCount = (w.session2ConfirmedCount ?? 0) + 1;
      }
      tx.update(adminDb.collection(WORKSHOPS).doc(w.id), update);
    }

    return {};
  });

  if (!result.error) {
    await updateRegistrationStatus(participantId, "assigned");
  }
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
