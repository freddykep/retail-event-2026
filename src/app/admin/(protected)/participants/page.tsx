import { listParticipants } from "@/lib/firestore/participants";
import { listRegistrations } from "@/lib/firestore/registrations";
import { listWaitlistEntries } from "@/lib/firestore/waitlist";
import { participantDisplayName } from "@/types/participant";
import { ParticipantImportPanel } from "@/components/admin/ParticipantImportPanel";
import { ExportPanel } from "@/components/admin/ExportPanel";
import { RegenerateCodeButton } from "@/components/admin/RegenerateCodeButton";
import { StatusPill } from "@/components/ui/StatusPill";

const STATUS_LABEL: Record<string, string> = {
  imported: "Importiert",
  not_registered: "Noch nicht angemeldet",
  registered: "Anmeldung abgeschlossen",
  assigned: "Zugewiesen",
  waitlisted: "Warteliste",
};

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export default async function AdminParticipantsPage() {
  const [participants, registrations, waitlist] = await Promise.all([
    listParticipants(),
    listRegistrations(),
    listWaitlistEntries(),
  ]);

  const registrationsById = new Map(registrations.map((r) => [r.participantId, r]));
  const waitlistById = new Map(waitlist.map((w) => [w.participantId, w]));
  const notExportedCount = participants.filter((p) => !p.exported).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-adesso-blue-4 sm:text-3xl">
          Teilnehmer
        </h1>
        <a
          href="/api/admin/export/results"
          className="text-sm font-semibold text-adesso-primary hover:underline"
        >
          Ergebnis-Export (CSV)
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ParticipantImportPanel />
        <ExportPanel notExportedCount={notExportedCount} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-adesso-grey-light bg-white">
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-adesso-grey-lighter text-xs font-semibold uppercase tracking-wide text-adesso-warmgrey">
              <tr>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">E-Mail</th>
                <th className="p-3.5">Exportiert</th>
                <th className="p-3.5">Anmeldung</th>
                <th className="p-3.5">Anmeldezeitpunkt</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => {
                const reg = registrationsById.get(p.id);
                const wl = waitlistById.get(p.id);
                return (
                  <tr
                    key={p.id}
                    className="border-t border-adesso-grey-light transition-colors hover:bg-adesso-grey-lighter/60"
                  >
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-adesso-primary/10 text-xs font-bold text-adesso-primary">
                          {initials(p.firstName, p.lastName)}
                        </span>
                        <span className="font-medium text-adesso-blue-4">
                          {participantDisplayName(p)}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 text-adesso-warmgrey">{p.email}</td>
                    <td className="p-3.5">
                      <StatusPill tone={p.exported ? "success" : "neutral"}>
                        {p.exported ? "Ja" : "Nein"}
                      </StatusPill>
                    </td>
                    <td className="p-3.5 text-adesso-blue-4">
                      {reg ? (reg.status === "confirmed" ? "Bestätigt" : "Warteliste") : "-"}
                      {wl ? ` (Pos. ${wl.position})` : ""}
                    </td>
                    <td className="p-3.5 text-adesso-warmgrey">
                      {reg ? new Date(reg.submittedAt).toLocaleString("de-DE") : "-"}
                    </td>
                    <td className="p-3.5">
                      <StatusPill tone={p.registrationStatus === "assigned" ? "success" : "neutral"}>
                        {STATUS_LABEL[p.registrationStatus] ?? p.registrationStatus}
                      </StatusPill>
                    </td>
                    <td className="p-3.5">
                      <RegenerateCodeButton participantId={p.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
