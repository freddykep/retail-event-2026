"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmParticipantImport,
  previewParticipantImport,
} from "@/app/actions/admin/participants";
import type { ParsedImport } from "@/lib/import/csv-parser";
import { Button } from "@/components/ui/Button";
import { IconUpload } from "@/components/ui/icons";

export function ParticipantImportPanel() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedImport | null>(null);
  const [pending, setPending] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  async function handleFile(file: File) {
    setPending(true);
    setResultMessage(null);
    const text = await file.text();
    const result = await previewParticipantImport(text);
    setPreview(result);
    setPending(false);
  }

  async function handleConfirm() {
    if (!preview) return;
    setPending(true);
    const validRows = preview.rows.filter((r) => r.valid).map((r) => r.data as {
      firstName: string;
      lastName: string;
      email: string;
    });
    const result = await confirmParticipantImport(validRows);
    setPending(false);
    setPreview(null);
    setResultMessage(`${result.importedCount} Teilnehmer erfolgreich importiert.`);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-adesso-grey-light bg-white p-6">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-adesso-primary">
          <IconUpload className="h-4 w-4" />
        </span>
        <h2 className="font-heading text-lg font-bold text-adesso-blue-4">
          Teilnehmer importieren (CSV)
        </h2>
      </div>
      <p className="mb-4 text-sm text-adesso-warmgrey">
        Spalten: Vorname, Nachname, E-Mail. Zugangscodes werden automatisch erzeugt.
      </p>

      <label className="mb-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-adesso-grey px-4 py-6 text-center text-sm text-adesso-warmgrey transition-colors hover:border-adesso-primary hover:text-adesso-primary">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
        />
        CSV-Datei auswählen oder hierher ziehen
      </label>

      {resultMessage && <p className="mb-4 text-sm font-medium text-green-700">{resultMessage}</p>}

      {preview && (
        <div>
          <p className="mb-3 text-sm font-medium text-adesso-blue-4">
            {preview.rows.length} Zeilen erkannt · {preview.validCount} können importiert werden ·{" "}
            {preview.errorCount} Fehler
          </p>

          <div className="mb-4 max-h-64 overflow-auto rounded border border-adesso-grey-light">
            <table className="w-full text-left text-sm">
              <thead className="bg-adesso-grey-lighter">
                <tr>
                  <th className="p-2">Zeile</th>
                  <th className="p-2">Vorname</th>
                  <th className="p-2">Nachname</th>
                  <th className="p-2">E-Mail</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.row} className={row.valid ? "" : "bg-red-50"}>
                    <td className="p-2">{row.row}</td>
                    <td className="p-2">{row.data.firstName}</td>
                    <td className="p-2">{row.data.lastName}</td>
                    <td className="p-2">{row.data.email}</td>
                    <td className="p-2 text-adesso-error">{row.errors.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleConfirm} disabled={pending || preview.validCount === 0}>
              {preview.validCount} Teilnehmer importieren
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={pending}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
