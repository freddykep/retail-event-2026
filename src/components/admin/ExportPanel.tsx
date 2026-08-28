"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { IconDownload } from "@/components/ui/icons";

async function downloadFrom(url: string, fallbackName: string) {
  const res = await fetch(url);
  if (!res.ok) {
    alert("Export fehlgeschlagen.");
    return;
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="(.+)"/);
  const filename = match?.[1] ?? fallbackName;

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ExportPanel({ notExportedCount }: { notExportedCount: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleExport(onlyNotExported: boolean) {
    if (!onlyNotExported && !confirm("Wirklich ALLE Teilnehmer erneut exportieren?")) {
      return;
    }
    setPending(true);
    await downloadFrom(
      `/api/admin/export/invitations?onlyNotExported=${onlyNotExported}`,
      "einladungen.xlsx"
    );
    setPending(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-adesso-grey-light bg-white p-6">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <IconDownload className="h-4 w-4" />
        </span>
        <h2 className="font-heading text-lg font-bold text-adesso-blue-4">
          Einladungen / Serienmail
        </h2>
      </div>
      <p className="mb-4 text-sm text-adesso-warmgrey">
        Exportiert Vorname, Nachname, E-Mail, Zugangscode und Anmeldelink als XLSX für den
        Seriendruck in Outlook/Word. Die App verschickt selbst keine E-Mails.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => handleExport(true)} disabled={pending || notExportedCount === 0}>
          {notExportedCount} noch nicht exportierte Teilnehmer exportieren
        </Button>
        <Button variant="secondary" onClick={() => handleExport(false)} disabled={pending}>
          Alle Teilnehmer erneut exportieren
        </Button>
      </div>
    </div>
  );
}
