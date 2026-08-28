import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { encryptAccessCode, generateAccessCode, hashAccessCode } from "@/lib/auth/access-code";
import { chunk } from "@/lib/firestore/batch-utils";
import type { ParticipantDoc, ParticipantImportRow } from "@/types/participant";

const COLLECTION = "participants";

function fromSnap(id: string, data: FirebaseFirestore.DocumentData): ParticipantDoc {
  return {
    id,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    accessCodeHash: data.accessCodeHash,
    accessCodeEncrypted: data.accessCodeEncrypted,
    createdAt: data.createdAt,
    exported: data.exported ?? false,
    exportedAt: data.exportedAt ?? null,
    registrationStatus: data.registrationStatus ?? "imported",
  };
}

/** Erzeugt Teilnehmer inkl. individuellem Zugangscode (Hash fuer Login, verschluesselt
 * fuer spaeteren XLSX-Export - siehe lib/auth/access-code.ts). In 400er-Batches
 * geschrieben, da ein Firestore-Batch maximal 500 Schreibvorgaenge erlaubt. */
export async function importParticipants(rows: ParticipantImportRow[]): Promise<ParticipantDoc[]> {
  const now = Date.now();
  const results: ParticipantDoc[] = [];

  for (const rowsChunk of chunk(rows, 400)) {
    const batch = adminDb.batch();
    for (const row of rowsChunk) {
      const ref = adminDb.collection(COLLECTION).doc();
      const accessCode = generateAccessCode();
      const data = {
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        accessCodeHash: hashAccessCode(accessCode),
        accessCodeEncrypted: encryptAccessCode(accessCode),
        createdAt: now,
        exported: false,
        exportedAt: null,
        registrationStatus: "imported",
      };
      batch.set(ref, data);
      results.push(fromSnap(ref.id, data));
    }
    await batch.commit();
  }

  return results;
}

export async function listParticipants(): Promise<ParticipantDoc[]> {
  const snap = await adminDb.collection(COLLECTION).orderBy("createdAt", "asc").get();
  return snap.docs.map((d) => fromSnap(d.id, d.data()));
}

export async function getParticipantById(id: string): Promise<ParticipantDoc | null> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return fromSnap(snap.id, snap.data()!);
}

export async function getParticipantByAccessCode(
  accessCodeHash: string
): Promise<ParticipantDoc | null> {
  const snap = await adminDb
    .collection(COLLECTION)
    .where("accessCodeHash", "==", accessCodeHash)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return fromSnap(snap.docs[0].id, snap.docs[0].data());
}

export async function existingEmails(): Promise<Set<string>> {
  const snap = await adminDb.collection(COLLECTION).select("email").get();
  return new Set(snap.docs.map((d) => (d.data().email as string).toLowerCase()));
}

/** Erzeugt einen neuen Zugangscode und macht den Teilnehmer wieder "nicht exportiert"
 * (z.B. wenn ein Teilnehmer seinen Code verloren hat und neu verschickt werden muss). */
export async function regenerateAccessCode(participantId: string): Promise<void> {
  const accessCode = generateAccessCode();
  await adminDb.collection(COLLECTION).doc(participantId).update({
    accessCodeHash: hashAccessCode(accessCode),
    accessCodeEncrypted: encryptAccessCode(accessCode),
    exported: false,
    exportedAt: null,
  });
}

export async function markParticipantsExported(participantIds: string[]): Promise<void> {
  const now = Date.now();
  const chunks: string[][] = [];
  for (let i = 0; i < participantIds.length; i += 400) chunks.push(participantIds.slice(i, i + 400));

  for (const ids of chunks) {
    const batch = adminDb.batch();
    for (const id of ids) {
      batch.update(adminDb.collection(COLLECTION).doc(id), { exported: true, exportedAt: now });
    }
    await batch.commit();
  }
}

/** Loescht einen Teilnehmer-Datensatz vollstaendig (inkl. Zugangscode). Reservierte
 * Workshop-Kapazitaet sowie Registrierung/Warteliste/Zuteilung muessen VOR diesem
 * Aufruf bereits ueber cancelRegistration()/removeDraftAssignment()/
 * removeFinalAssignment() bereinigt worden sein (siehe deleteParticipantAction). */
export async function deleteParticipant(participantId: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(participantId).delete();
}

export async function updateRegistrationStatus(
  participantId: string,
  status: ParticipantDoc["registrationStatus"]
): Promise<void> {
  await adminDb.collection(COLLECTION).doc(participantId).update({ registrationStatus: status });
}
