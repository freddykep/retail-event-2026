import { listWorkshops } from "@/lib/firestore/workshops";
import { listDraftAssignments } from "@/lib/firestore/assignments";
import { listParticipants } from "@/lib/firestore/participants";
import { getEventConfig } from "@/lib/firestore/event-config";
import { participantDisplayName } from "@/types/participant";
import { AllocationControls } from "@/components/admin/AllocationControls";
import { AllocationEditRow } from "@/components/admin/AllocationEditRow";
import { StatusPill } from "@/components/ui/StatusPill";
import { slotKey } from "@/lib/allocation/session-slots";
import type { WorkshopDoc } from "@/types/workshop";

export default async function AdminAllocationPage() {
  const [workshops, draftAssignments, participants, config] = await Promise.all([
    listWorkshops(),
    listDraftAssignments(),
    listParticipants(),
    getEventConfig(),
  ]);

  const participantsById = new Map(participants.map((p) => [p.id, p]));
  const workshopsById = new Map(workshops.map((w) => [w.id, w]));
  const draftMeta = config.draftMeta;

  const usageBySlot = new Map<string, number>();
  for (const a of draftAssignments) {
    for (const id of a.workshopIds) {
      const w = workshopsById.get(id);
      const key = slotKey(id, w?.session ?? null, a.sessionAssignment);
      usageBySlot.set(key, (usageBySlot.get(key) ?? 0) + 1);
    }
  }

  const fullSessionWorkshops = workshops.filter((w) => w.durationMinutes === 120);
  const session1Workshops = workshops.filter(
    (w) => w.durationMinutes === 60 && (w.session === 1 || w.session === "both")
  );
  const session2Workshops = workshops.filter(
    (w) => w.durationMinutes === 60 && (w.session === 2 || w.session === "both")
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading mb-4 text-2xl font-bold text-adesso-blue-4 sm:text-3xl">
          Zuteilung
        </h1>
        <AllocationControls
          registrationOpen={config.registrationOpen}
          assignmentPublished={config.assignmentPublished}
          allocationMode={config.allocationMode}
          draftCount={draftAssignments.length}
          waitlistCount={draftMeta?.waitlisted.length ?? 0}
          conflictCount={draftMeta?.conflicts.length ?? 0}
        />
        {draftMeta && (
          <p className="mt-3 text-sm text-adesso-warmgrey">
            Vorschlag erstellt am {new Date(draftMeta.generatedAt).toLocaleString("de-DE")} ·{" "}
            {draftAssignments.length} zugeteilt · {draftMeta.waitlisted.length} Warteliste ·{" "}
            {draftMeta.conflicts.length} Konflikte
          </p>
        )}
      </div>

      {fullSessionWorkshops.length > 0 && (
        <FullSessionOverview workshops={fullSessionWorkshops} usage={usageBySlot} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SessionOverview title="Session 1" session={1} workshops={session1Workshops} usage={usageBySlot} />
        <SessionOverview title="Session 2" session={2} workshops={session2Workshops} usage={usageBySlot} />
      </div>

      <div>
        <h2 className="font-heading mb-3 text-lg font-bold text-adesso-blue-4">
          Zugeteilte Teilnehmer ({draftAssignments.length})
        </h2>
        <div className="overflow-hidden rounded-2xl border border-adesso-grey-light bg-white">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-adesso-grey-lighter text-xs font-semibold uppercase tracking-wide text-adesso-warmgrey">
              <tr>
                <th className="p-3.5">Teilnehmer</th>
                <th className="p-3.5">Zuteilung</th>
                <th className="p-3.5">Score</th>
                <th className="p-3.5">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {draftAssignments.map((a) => (
                <tr
                  key={a.participantId}
                  className="border-t border-adesso-grey-light align-top transition-colors hover:bg-adesso-grey-lighter/60"
                >
                  <td className="p-3.5 font-medium text-adesso-blue-4">
                    {participantsById.get(a.participantId)
                      ? participantDisplayName(participantsById.get(a.participantId)!)
                      : a.participantId}
                  </td>
                  <td className="p-3.5">
                    {a.workshopIds.map((id) => workshopsById.get(id)?.title ?? id).join(" + ")}
                  </td>
                  <td className="p-3.5">{a.score}</td>
                  <td className="p-3.5">
                    <AllocationEditRow
                      participantId={a.participantId}
                      currentWorkshopIds={a.workshopIds}
                      workshops={workshops}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {draftMeta && draftMeta.waitlisted.length > 0 && (
        <div>
          <h2 className="font-heading mb-3 text-lg font-bold text-adesso-blue-4">
            Warteliste ({draftMeta.waitlisted.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {draftMeta.waitlisted.map((w) => (
              <li
                key={w.participantId}
                className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-sm"
              >
                <span className="font-medium text-adesso-blue-4">
                  {participantsById.get(w.participantId)
                    ? participantDisplayName(participantsById.get(w.participantId)!)
                    : w.participantId}
                </span>
                <span className="text-adesso-warmgrey">
                  Wunsch: {w.workshopIds.map((id) => workshopsById.get(id)?.title ?? id).join(" + ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {draftMeta && draftMeta.conflicts.length > 0 && (
        <div>
          <h2 className="font-heading mb-3 text-lg font-bold text-adesso-error">
            Konflikte ({draftMeta.conflicts.length})
          </h2>
          <p className="mb-3 text-sm text-adesso-warmgrey">
            Aus den Präferenzen dieser Teilnehmer lässt sich keine gültige Kombination bilden -
            bitte manuell zuteilen.
          </p>
          <ul className="flex flex-col gap-2">
            {draftMeta.conflicts.map((id) => (
              <li key={id} className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm">
                <div className="mb-2 font-medium text-adesso-blue-4">
                  {participantsById.get(id) ? participantDisplayName(participantsById.get(id)!) : id}
                </div>
                <AllocationEditRow participantId={id} currentWorkshopIds={[]} workshops={workshops} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FullSessionOverview({
  workshops,
  usage,
}: {
  workshops: Pick<WorkshopDoc, "id" | "title" | "capacity">[];
  usage: Map<string, number>;
}) {
  return (
    <div className="rounded-2xl border border-adesso-grey-light bg-white p-5">
      <h2 className="font-heading mb-4 font-bold text-adesso-blue-4">
        2-Stunden-Workshops (belegen beide Sessions)
      </h2>
      <ul className="grid gap-4 text-sm sm:grid-cols-2">
        {workshops.map((w) => {
          const used = usage.get(w.id) ?? 0;
          const full = used >= w.capacity;
          const pct = w.capacity > 0 ? Math.min(100, Math.round((used / w.capacity) * 100)) : 0;
          return (
            <li key={w.id}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-adesso-blue-4">{w.title}</span>
                <StatusPill tone={full ? "danger" : "info"}>
                  {used} / {w.capacity}
                </StatusPill>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-adesso-grey-lighter">
                <div
                  className={`h-full rounded-full ${full ? "bg-adesso-error" : "bg-adesso-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SessionOverview({
  title,
  session,
  workshops,
  usage,
}: {
  title: string;
  session: 1 | 2;
  workshops: Pick<WorkshopDoc, "id" | "title" | "capacity" | "session">[];
  usage: Map<string, number>;
}) {
  return (
    <div className="rounded-2xl border border-adesso-grey-light bg-white p-5">
      <h2 className="font-heading mb-4 font-bold text-adesso-blue-4">{title}</h2>
      <ul className="flex flex-col gap-4 text-sm">
        {workshops.map((w) => {
          const key = slotKey(w.id, w.session, w.session === "both" ? { [w.id]: session } : undefined);
          const used = usage.get(key) ?? 0;
          const full = used >= w.capacity;
          const pct = w.capacity > 0 ? Math.min(100, Math.round((used / w.capacity) * 100)) : 0;
          return (
            <li key={w.id}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-adesso-blue-4">{w.title}</span>
                <StatusPill tone={full ? "danger" : "info"}>
                  {used} / {w.capacity}
                </StatusPill>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-adesso-grey-lighter">
                <div
                  className={`h-full rounded-full ${full ? "bg-adesso-error" : "bg-adesso-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
