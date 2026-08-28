import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/guards";
import { listParticipants } from "@/lib/firestore/participants";
import { listRegistrations } from "@/lib/firestore/registrations";
import { listFinalAssignments } from "@/lib/firestore/assignments";
import { listWaitlistEntries } from "@/lib/firestore/waitlist";
import { listWorkshops } from "@/lib/firestore/workshops";
import { buildParticipantsExportCsv } from "@/lib/export/csv-export";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const [participants, registrations, assignments, waitlist, workshops] = await Promise.all([
    listParticipants(),
    listRegistrations(),
    listFinalAssignments(),
    listWaitlistEntries(),
    listWorkshops(),
  ]);

  const csv = buildParticipantsExportCsv({
    participants,
    registrations: new Map(registrations.map((r) => [r.participantId, r])),
    assignments: new Map(assignments.map((a) => [a.participantId, a])),
    waitlist: new Map(waitlist.map((w) => [w.participantId, w])),
    workshopsById: new Map(workshops.map((w) => [w.id, w])),
  });

  const BOM = "﻿"; // Excel oeffnet UTF-8-CSV mit Umlauten nur mit BOM korrekt
  return new NextResponse(BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="teilnehmer-export-${Date.now()}.csv"`,
    },
  });
}
