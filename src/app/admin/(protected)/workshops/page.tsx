import Image from "next/image";
import Link from "next/link";
import { listWorkshops } from "@/lib/firestore/workshops";
import { effectiveCapacity } from "@/types/workshop";
import { DeleteWorkshopButton } from "@/components/admin/DeleteWorkshopButton";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { formatDuration } from "@/lib/format";

function sessionLabel(w: { durationMinutes: 60 | 120; session: 1 | 2 | "both" | null }): string {
  if (w.durationMinutes === 120) return "beide Sessions";
  if (w.session === "both") return "beide Sessions (je eigene Kapazität)";
  return `Session ${w.session}`;
}

export default async function AdminWorkshopsPage() {
  const workshops = await listWorkshops();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-adesso-blue-4 sm:text-3xl">
          Workshops
        </h1>
        <Link href="/admin/workshops/new">
          <Button>+ Workshop anlegen</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {workshops.map((w) => (
          <div
            key={w.id}
            className="card-hover flex flex-col overflow-hidden rounded-2xl border border-adesso-grey-light bg-white sm:flex-row sm:items-stretch"
          >
            <div className="relative h-48 w-full shrink-0 bg-adesso-grey-lighter sm:h-auto sm:w-80">
              {w.imageUrl ? (
                <Image
                  src={w.imageUrl}
                  alt={w.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 320px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="font-heading text-xl font-bold text-adesso-warmgrey opacity-30">
                    adesso
                  </span>
                </div>
              )}
              <div className="absolute right-2.5 top-2.5">
                <StatusPill tone={w.active ? "success" : "neutral"}>
                  {w.active ? "Aktiv" : "Inaktiv"}
                </StatusPill>
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-3 p-5">
              <div>
                <h2 className="font-heading mb-1 text-lg font-bold text-adesso-blue-4">{w.title}</h2>
                <p className="mb-2 text-sm text-adesso-warmgrey">{w.description}</p>
                <p className="text-sm text-adesso-warmgrey">
                  {formatDuration(w.durationMinutes)} · {sessionLabel(w)}
                </p>
                <p className="text-sm font-medium text-adesso-blue-3">
                  {w.confirmedCount} / {effectiveCapacity(w)} belegt
                  {w.session === "both" ? ` (je ${w.capacity} pro Session)` : ""}
                  {w.waitlistCount > 0 ? ` · ${w.waitlistCount} Warteliste` : ""}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Link
                  href={`/admin/workshops/${w.id}`}
                  className="text-sm font-semibold text-adesso-primary hover:underline"
                >
                  Bearbeiten
                </Link>
                <DeleteWorkshopButton workshopId={w.id} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
