import { describe, expect, it } from "vitest";
import { parseParticipantsCsv } from "@/lib/import/csv-parser";

describe("parseParticipantsCsv", () => {
  it("parst gueltige Zeilen mit deutschen Spaltennamen", () => {
    const csv = "Vorname,Nachname,E-Mail\nMax,Mustermann,max@firma.de\nSabine,Meier,sabine@firma.de";
    const result = parseParticipantsCsv(csv, new Set());
    expect(result.validCount).toBe(2);
    expect(result.errorCount).toBe(0);
  });

  it("erkennt fehlende Pflichtfelder und ungueltige E-Mails", () => {
    const csv = "Vorname,Nachname,E-Mail\n,Mustermann,max@firma.de\nSabine,Meier,keine-email";
    const result = parseParticipantsCsv(csv, new Set());
    expect(result.errorCount).toBe(2);
    expect(result.validCount).toBe(0);
  });

  it("erkennt Duplikate innerhalb der Datei und gegen bestehende Teilnehmer", () => {
    const csv =
      "Vorname,Nachname,E-Mail\nMax,Mustermann,max@firma.de\nMax,Mustermann,max@firma.de\nSabine,Meier,sabine@firma.de";
    const result = parseParticipantsCsv(csv, new Set(["sabine@firma.de"]));
    expect(result.validCount).toBe(1); // nur die erste Max-Zeile waere ohne Duplikat gueltig, aber beide sind als Duplikat markiert
    expect(result.errorCount).toBe(2);
  });
});
