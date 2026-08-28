import { listParticipants } from "@/lib/firestore/participants";
import { listWorkshops } from "@/lib/firestore/workshops";
import { effectiveCapacity } from "@/types/workshop";
import { listRegistrations } from "@/lib/firestore/registrations";
import { listWaitlistEntries } from "@/lib/firestore/waitlist";
import { getEventConfig } from "@/lib/firestore/event-config";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconDownload,
  IconList,
  IconSeats,
  IconUpload,
  IconUsers,
} from "@/components/ui/icons";

function Stat({
  label,
  value,
  icon,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: "primary" | "mint" | "mustard";
}) {
  const accentClasses = {
    primary: "bg-blue-50 text-adesso-primary",
    mint: "bg-emerald-50 text-emerald-600",
    mustard: "bg-amber-50 text-amber-600",
  }[accent];

  return (
    <div className="card-hover rounded-2xl border border-adesso-grey-light bg-white p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${accentClasses}`}>
        {icon}
      </div>
      <p className="text-sm text-adesso-warmgrey">{label}</p>
      <p className="font-heading mt-1 text-3xl font-bold text-adesso-blue-4">{value}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const [participants, workshops, registrations, waitlist, config] = await Promise.all([
    listParticipants(),
    listWorkshops(),
    listRegistrations(),
    listWaitlistEntries(),
    getEventConfig(),
  ]);

  const registeredCount = registrations.length;
  const exportedCount = participants.filter((p) => p.exported).length;
  const totalCapacity = workshops.reduce((sum, w) => sum + effectiveCapacity(w), 0);
  const totalConfirmed = workshops.reduce((sum, w) => sum + w.confirmedCount, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-adesso-blue-4 sm:text-3xl">
          Dashboard
        </h1>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={config.registrationOpen ? "success" : "neutral"}>
            Anmeldung {config.registrationOpen ? "geöffnet" : "geschlossen"}
          </StatusPill>
          <StatusPill tone={config.assignmentPublished ? "success" : "neutral"}>
            Zuteilung {config.assignmentPublished ? "veröffentlicht" : "nicht veröffentlicht"}
          </StatusPill>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Teilnehmer insgesamt" value={participants.length} icon={<IconUsers />} />
        <Stat label="Angemeldet" value={registeredCount} icon={<IconCheck />} accent="mint" />
        <Stat
          label="Noch nicht angemeldet"
          value={participants.length - registeredCount}
          icon={<IconClock />}
          accent="mustard"
        />
        <Stat label="Workshops" value={workshops.length} icon={<IconCalendar />} />
        <Stat
          label="Belegte Plätze"
          value={`${totalConfirmed} / ${totalCapacity}`}
          icon={<IconSeats />}
        />
        <Stat label="Auf Wartelisten" value={waitlist.length} icon={<IconList />} accent="mustard" />
        <Stat
          label="Für Export bereit"
          value={participants.length - exportedCount}
          icon={<IconUpload />}
        />
        <Stat label="Bereits exportiert" value={exportedCount} icon={<IconDownload />} accent="mint" />
      </div>
    </div>
  );
}
