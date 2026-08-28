import "server-only";
import { adminDb, FieldValue } from "@/lib/firebase/admin";
import type { WorkshopDoc, WorkshopInput } from "@/types/workshop";

const COLLECTION = "workshops";

function fromSnap(id: string, data: FirebaseFirestore.DocumentData): WorkshopDoc {
  return {
    id,
    title: data.title,
    description: data.description,
    imageUrl: data.imageUrl ?? null,
    durationMinutes: data.durationMinutes,
    session: data.session ?? null,
    capacity: data.capacity,
    confirmedCount: data.confirmedCount ?? 0,
    waitlistCount: data.waitlistCount ?? 0,
    session1ConfirmedCount: data.session1ConfirmedCount ?? 0,
    session2ConfirmedCount: data.session2ConfirmedCount ?? 0,
    room: data.room ?? "",
    speaker: data.speaker ?? "",
    active: data.active ?? true,
    createdAt: data.createdAt ?? 0,
    updatedAt: data.updatedAt ?? 0,
  };
}

export async function createWorkshop(input: WorkshopInput): Promise<WorkshopDoc> {
  const now = Date.now();
  const ref = adminDb.collection(COLLECTION).doc();
  const data = {
    title: input.title,
    description: input.description,
    imageUrl: null,
    durationMinutes: input.durationMinutes,
    session: input.durationMinutes === 60 ? input.session : null,
    capacity: input.capacity,
    confirmedCount: 0,
    waitlistCount: 0,
    session1ConfirmedCount: 0,
    session2ConfirmedCount: 0,
    room: input.room,
    speaker: input.speaker,
    active: input.active,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(data);
  return fromSnap(ref.id, data);
}

export async function updateWorkshop(
  id: string,
  input: Partial<WorkshopInput> & { imageUrl?: string | null }
): Promise<void> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const update: Record<string, unknown> = { ...input, updatedAt: Date.now() };
  if (input.durationMinutes === 120) {
    update.session = null;
  }
  await ref.update(update);
}

export async function deleteWorkshop(id: string): Promise<void> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  const data = snap.data();
  if (data && (data.confirmedCount ?? 0) > 0) {
    throw new Error(
      "Workshop hat bereits bestaetigte Anmeldungen und kann nicht geloescht werden - bitte deaktivieren."
    );
  }
  await ref.delete();
}

export async function listWorkshops(options?: { activeOnly?: boolean }): Promise<WorkshopDoc[]> {
  let query: FirebaseFirestore.Query = adminDb.collection(COLLECTION);
  if (options?.activeOnly) {
    query = query.where("active", "==", true);
  }
  const snap = await query.get();
  return snap.docs.map((d) => fromSnap(d.id, d.data()));
}

export async function getWorkshopById(id: string): Promise<WorkshopDoc | null> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return fromSnap(snap.id, snap.data()!);
}

export async function getWorkshopsByIds(ids: string[]): Promise<WorkshopDoc[]> {
  if (ids.length === 0) return [];
  const snaps = await Promise.all(ids.map((id) => adminDb.collection(COLLECTION).doc(id).get()));
  return snaps.filter((s) => s.exists).map((s) => fromSnap(s.id, s.data()!));
}

export async function adjustWorkshopCounts(
  changes: Array<{ id: string; confirmedDelta?: number; waitlistDelta?: number }>
): Promise<void> {
  await Promise.all(
    changes.map(({ id, confirmedDelta = 0, waitlistDelta = 0 }) => {
      if (confirmedDelta === 0 && waitlistDelta === 0) return Promise.resolve();
      return adminDb
        .collection(COLLECTION)
        .doc(id)
        .update({
          ...(confirmedDelta !== 0 ? { confirmedCount: FieldValue.increment(confirmedDelta) } : {}),
          ...(waitlistDelta !== 0 ? { waitlistCount: FieldValue.increment(waitlistDelta) } : {}),
        });
    })
  );
}
