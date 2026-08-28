import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/guards";
import { listParticipants, markParticipantsExported } from "@/lib/firestore/participants";
import { decryptAccessCode } from "@/lib/auth/access-code";
import { buildInvitationsXlsx } from "@/lib/export/xlsx-export";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const onlyNotExported = request.nextUrl.searchParams.get("onlyNotExported") === "true";
  const all = await listParticipants();
  const selected = onlyNotExported ? all.filter((p) => !p.exported) : all;

  const rows = selected.map((p) => ({
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    accessCode: decryptAccessCode(p.accessCodeEncrypted),
  }));

  const buffer = buildInvitationsXlsx(rows, env.appUrl);
  await markParticipantsExported(selected.map((p) => p.id));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="einladungen-${Date.now()}.xlsx"`,
    },
  });
}
