import { requireParticipant } from "@/lib/auth/guards";
import { getParticipantById } from "@/lib/firestore/participants";
import { listWorkshops } from "@/lib/firestore/workshops";
import { getRegistration } from "@/lib/firestore/registrations";
import { getEventConfig } from "@/lib/firestore/event-config";
import { WorkshopOverview } from "@/components/participant/WorkshopOverview";
import { ParticipantHeader } from "@/components/participant/ParticipantHeader";
import { redirect } from "next/navigation";

export default async function WorkshopsPage() {
  const { participantId } = await requireParticipant();

  const [participant, workshops, registration, config] = await Promise.all([
    getParticipantById(participantId),
    listWorkshops({ activeOnly: true }),
    getRegistration(participantId),
    getEventConfig(),
  ]);

  if (!participant) {
    redirect("/login");
  }

  if (config.assignmentPublished) {
    redirect("/result");
  }

  return (
    <main className="min-h-screen bg-adesso-grey-lighter pb-16">
      <ParticipantHeader firstName={participant.firstName} />

      <div className="mx-auto max-w-6xl px-4 pt-8">
        {!config.registrationOpen ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-adesso-blue-4">
            Die Anmeldephase ist beendet. Es sind aktuell keine Änderungen mehr möglich.
          </div>
        ) : (
          <WorkshopOverview
            workshops={workshops}
            participantName={participant.firstName}
            initialPreferences={registration?.preferences ?? []}
          />
        )}
      </div>
    </main>
  );
}
