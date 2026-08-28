import type { ParticipantDoc } from "@/types/participant";
import type { RegistrationDoc, WaitlistEntryDoc } from "@/types/registration";
import type { AssignmentDoc } from "@/types/assignment";
import type { WorkshopDoc } from "@/types/workshop";

function csvEscape(value: string): string {
  if (/[",;\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "";
  return new Date(ts).toISOString();
}

export function buildParticipantsExportCsv(data: {
  participants: ParticipantDoc[];
  registrations: Map<string, RegistrationDoc>;
  assignments: Map<string, AssignmentDoc>;
  waitlist: Map<string, WaitlistEntryDoc>;
  workshopsById: Map<string, WorkshopDoc>;
}): string {
  const header = [
    "Vorname",
    "Nachname",
    "E-Mail",
    "Anmeldezeitpunkt",
    "Präferenz 1",
    "Präferenz 2",
    "Präferenz 3",
    "Finale Zuteilung",
    "Session 1",
    "Session 2",
    "Wartelistenstatus",
  ];

  const workshopTitle = (id: string | undefined | null) =>
    id ? (data.workshopsById.get(id)?.title ?? id) : "";

  const rows = data.participants.map((p) => {
    const reg = data.registrations.get(p.id);
    const assignment = data.assignments.get(p.id);
    const waitlist = data.waitlist.get(p.id);

    const prefs = reg?.preferences ?? [];
    const finalTitles = assignment?.workshopIds.map(workshopTitle).join(" + ") ?? "";

    return [
      p.firstName,
      p.lastName,
      p.email,
      formatDate(reg?.submittedAt),
      workshopTitle(prefs[0]),
      workshopTitle(prefs[1]),
      workshopTitle(prefs[2]),
      finalTitles,
      workshopTitle(assignment?.session1WorkshopId),
      workshopTitle(assignment?.session2WorkshopId),
      waitlist ? `Warteliste Position ${waitlist.position}` : "",
    ];
  });

  return [header, ...rows]
    .map((row) => row.map((cell) => csvEscape(String(cell))).join(";"))
    .join("\n");
}
