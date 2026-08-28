import { redirect } from "next/navigation";
import { requireParticipant } from "@/lib/auth/guards";
import { getParticipantById } from "@/lib/firestore/participants";
import { getRegistration } from "@/lib/firestore/registrations";
import { getWaitlistEntry } from "@/lib/firestore/waitlist";
import { getFinalAssignment } from "@/lib/firestore/assignments";
import { getWorkshopsByIds } from "@/lib/firestore/workshops";
import { getEventConfig } from "@/lib/firestore/event-config";
import { ParticipantHeader } from "@/components/participant/ParticipantHeader";
import { ReservedWorkshopTile } from "@/components/participant/ReservedWorkshopTile";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";

export default async function ResultPage() {
  const { participantId } = await requireParticipant();

  const [participant, registration, config] = await Promise.all([
    getParticipantById(participantId),
    getRegistration(participantId),
    getEventConfig(),
  ]);

  if (!participant) redirect("/login");

  // Nur zurueck zur Auswahl schicken, solange die Anmeldephase noch laeuft - nach
  // Veroeffentlichung waere /workshops seinerseits ein Redirect zurueck hierher
  // (Endlosschleife) fuer Teilnehmer, die nie eine Anmeldung abgegeben haben.
  if (!registration && !config.assignmentPublished) redirect("/workshops");

  if (config.assignmentPublished) {
    if (!registration) {
      return (
        <ResultShell firstName={participant.firstName}>
          <Card className="p-8 text-center">
            <p className="text-adesso-blue-4">
              Für dich liegt keine Anmeldung vor, da du keine Workshop-Präferenzen abgegeben
              hast. Bitte wende dich an das Event-Team.
            </p>
          </Card>
        </ResultShell>
      );
    }

    const assignment = await getFinalAssignment(participantId);
    if (!assignment) {
      return (
        <ResultShell firstName={participant.firstName}>
          <Card className="p-8 text-center">
            <p className="text-adesso-blue-4">
              Für dich liegt aktuell keine finale Zuteilung vor. Bitte wende dich an das
              Event-Team.
            </p>
          </Card>
        </ResultShell>
      );
    }

    const workshops = await getWorkshopsByIds(assignment.workshopIds);
    const workshopsById = new Map(workshops.map((w) => [w.id, w]));

    return (
      <ResultShell firstName={participant.firstName}>
        <div className="mb-4 flex justify-center">
          <StatusPill tone="success">Finale Zuteilung veröffentlicht</StatusPill>
        </div>
        {assignment.workshopIds.length === 1 ? (
          <Card className="bg-event-gradient overflow-hidden p-8 text-center text-white">
            <p className="mb-1 text-sm font-medium text-white/80">Dein Workshop · 2 Stunden</p>
            <h2 className="font-heading text-2xl font-bold">
              {workshopsById.get(assignment.workshopIds[0])?.title}
            </h2>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="bg-event-gradient overflow-hidden p-6 text-center text-white">
              <p className="mb-1 text-sm font-medium text-white/80">Session 1</p>
              <h2 className="font-heading text-xl font-bold">
                {workshopsById.get(assignment.session1WorkshopId ?? "")?.title}
              </h2>
            </Card>
            <Card className="bg-event-gradient overflow-hidden p-6 text-center text-white">
              <p className="mb-1 text-sm font-medium text-white/80">Session 2</p>
              <h2 className="font-heading text-xl font-bold">
                {workshopsById.get(assignment.session2WorkshopId ?? "")?.title}
              </h2>
            </Card>
          </div>
        )}
      </ResultShell>
    );
  }

  if (!registration) redirect("/workshops");

  const waitlist = registration.status === "waitlisted" ? await getWaitlistEntry(participantId) : null;
  const isWaitlisted = registration.status === "waitlisted";
  const workshops = await getWorkshopsByIds(
    isWaitlisted ? (waitlist?.workshopIds ?? []) : registration.confirmedWorkshopIds
  );

  return (
    <ResultShell firstName={participant.firstName}>
      <div className="mb-4 flex justify-center">
        {isWaitlisted ? (
          <StatusPill tone="warning">
            Warteliste{waitlist ? ` · Position ${waitlist.position}` : ""}
          </StatusPill>
        ) : (
          <StatusPill tone="info">Vorläufig reserviert</StatusPill>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {workshops.map((w) => (
          <ReservedWorkshopTile key={w.id} workshop={w} waitlisted={isWaitlisted} />
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-adesso-warmgrey">
        Die finale Zuteilung wird erst nach Ende der Anmeldephase veröffentlicht.
      </p>
    </ResultShell>
  );
}

function ResultShell({ firstName, children }: { firstName: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-adesso-grey-lighter pb-16">
      <ParticipantHeader firstName={firstName} />
      <div className="mx-auto max-w-2xl px-4 pt-8">{children}</div>
    </main>
  );
}
