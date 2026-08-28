import Image from "next/image";
import type { WorkshopDoc } from "@/types/workshop";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDuration } from "@/lib/format";

export function ReservedWorkshopTile({
  workshop,
  waitlisted = false,
}: {
  workshop: WorkshopDoc;
  waitlisted?: boolean;
}) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border bg-white text-left sm:flex-row sm:items-stretch ${
        waitlisted ? "border-adesso-grey-light opacity-60 grayscale" : "border-adesso-primary/30"
      }`}
    >
      <div className="relative h-28 w-full shrink-0 overflow-hidden bg-adesso-grey-lighter sm:h-auto sm:w-44">
        {workshop.imageUrl ? (
          <Image
            src={workshop.imageUrl}
            alt={workshop.title}
            fill
            sizes="(max-width: 640px) 100vw, 176px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-adesso-warmgrey">
            <span className="font-heading text-lg font-bold opacity-30">adesso</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1.5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading font-bold text-adesso-blue-4">{workshop.title}</h3>
          {waitlisted ? (
            <StatusPill tone="warning">Warteliste</StatusPill>
          ) : (
            <StatusPill tone="info">Reserviert</StatusPill>
          )}
        </div>
        <p className="text-xs text-adesso-warmgrey">
          {formatDuration(workshop.durationMinutes)}
          {workshop.speaker ? (
            <>
              {" · "}
              <span className="font-medium text-adesso-blue-3">Moderiert von</span> {workshop.speaker}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
