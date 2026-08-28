"use client";

import Image from "next/image";
import { capacityStatus, type WorkshopDoc } from "@/types/workshop";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDuration } from "@/lib/format";

const STATUS_LABEL = {
  available: "Plätze verfügbar",
  few: "Wenige Plätze",
  full: "Ausgebucht",
} as const;

const STATUS_TONE = {
  available: "success",
  few: "warning",
  full: "danger",
} as const;

interface WorkshopTileProps {
  workshop: WorkshopDoc;
  rank: number | null;
  disabled?: boolean;
  onToggle: () => void;
  onEnlarge: () => void;
}

export function WorkshopTile({ workshop, rank, disabled = false, onToggle, onEnlarge }: WorkshopTileProps) {
  const status = capacityStatus(workshop);
  const selected = Boolean(rank);

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      aria-pressed={selected}
      aria-disabled={disabled}
      title={disabled ? "Nicht kombinierbar mit deiner aktuellen Auswahl" : undefined}
      className={`card-hover group flex w-full flex-col overflow-hidden rounded-2xl border bg-white text-left sm:flex-row sm:items-stretch ${
        disabled
          ? "pointer-events-none border-adesso-grey-light opacity-45 grayscale"
          : selected
            ? "border-adesso-primary ring-2 ring-adesso-primary/30"
            : "border-adesso-grey-light hover:border-adesso-primary/40"
      }`}
    >
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-adesso-grey-lighter sm:h-auto sm:w-80">
        {selected && (
          <span className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-adesso-primary text-sm font-bold text-white shadow-lg shadow-black/20">
            {rank}
          </span>
        )}
        {workshop.imageUrl ? (
          <>
            <Image
              src={workshop.imageUrl}
              alt={workshop.title}
              fill
              sizes="(max-width: 640px) 100vw, 320px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent sm:hidden" />
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onEnlarge();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onEnlarge();
                }
              }}
              aria-label="Bild vergrößern"
              className="pointer-events-auto absolute bottom-2.5 right-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path
                  d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-adesso-warmgrey">
            <span className="font-heading text-2xl font-bold opacity-30">adesso</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-lg font-bold text-adesso-blue-4">{workshop.title}</h3>
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-adesso-warmgrey">
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2} />
              <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
            {formatDuration(workshop.durationMinutes)}
          </span>
        </div>

        <p className="text-sm text-adesso-warmgrey line-clamp-2 sm:line-clamp-3">
          {workshop.description}
        </p>

        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusPill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusPill>
            {workshop.speaker && (
              <span className="text-xs text-adesso-warmgrey">
                <span className="font-medium text-adesso-blue-3">Moderiert von</span>{" "}
                {workshop.speaker}
              </span>
            )}
          </div>
          {status === "full" && (
            <p className="text-xs text-adesso-warmgrey">
              Du kannst dich trotzdem auswählen und landest auf der Warteliste.
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
