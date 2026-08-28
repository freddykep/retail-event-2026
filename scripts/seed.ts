/**
 * Demo-Daten fuer die lokale Entwicklung/Vorfuehrung: 8 Workshops (6x 60min, 2x 120min,
 * unterschiedliche Kapazitaeten) und 12 Teilnehmer mit Anmeldungen, die gezielt die in
 * der Anforderung genannten Szenarien abdecken (voller Workshop, Warteliste, gleiche/
 * unterschiedliche Praeferenzen, knappe Kapazitaeten, 60+60- und 120-Kombinationen,
 * Teilnehmer mit schlechteren Alternativen, ein bewusster Praeferenz-Konflikt).
 *
 * Bewusst eigenstaendig (dupliziert einen kleinen Teil der App-Logik) statt die
 * "src/lib/firestore/*"-Module zu importieren: diese sind mit `import "server-only"`
 * geschuetzt, was nur unter dem Next.js-Bundler funktioniert und ein eigenstaendiges
 * Skript (per `tsx`) unabhaengig vom Next-Build sofort zum Absturz bringen wuerde.
 * Die reine, Firestore-unabhaengige Zuteilungslogik (lib/allocation) wird dagegen
 * regulaer importiert.
 *
 * Aufruf: npm run seed  (verwendet dieselben Firebase-Env-Variablen wie die App)
 */
import { config } from "dotenv";
import { randomInt, randomBytes, createHmac, createCipheriv } from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { enumerateBundles } from "@/lib/allocation/bundles";
import type { AllocParticipant, AllocWorkshop } from "@/types/allocation";

config({ path: ".env.local", quiet: true });

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Fehlende Umgebungsvariable: ${name}`);
  return value;
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: requiredEnv("FIREBASE_PROJECT_ID"),
        clientEmail: requiredEnv("FIREBASE_CLIENT_EMAIL"),
        privateKey: requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    });
const db = getFirestore(app);

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
function generateAccessCode(): string {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}
function hashAccessCode(code: string): string {
  return createHmac("sha256", requiredEnv("APP_HMAC_SECRET")).update(code).digest("hex");
}
function encryptAccessCode(code: string): string {
  const key = Buffer.from(requiredEnv("ACCESS_CODE_ENCRYPTION_KEY"), "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(":");
}

interface WorkshopSeed {
  title: string;
  description: string;
  durationMinutes: 60 | 120;
  session: 1 | 2 | null;
  capacity: number;
  room: string;
  speaker: string;
}

const workshopDefs: WorkshopSeed[] = [
  { title: "KI im Einkauf", description: "Wie generative KI Beschaffungsprozesse in der Praxis veraendert.", durationMinutes: 60, session: 1, capacity: 2, room: "Raum A", speaker: "Dr. Lena Vogt" },
  { title: "Retail Innovation", description: "Neue Technologien im stationaeren und Online-Handel.", durationMinutes: 60, session: 2, capacity: 20, room: "Raum B", speaker: "Tom Brandt" },
  { title: "Future of Commerce", description: "Trends im E-Commerce der naechsten fuenf Jahre.", durationMinutes: 60, session: 1, capacity: 20, room: "Raum C", speaker: "Nina Krüger" },
  { title: "Digitale Lieferketten", description: "Transparenz und Resilienz in globalen Lieferketten durch IT.", durationMinutes: 60, session: 2, capacity: 3, room: "Raum D", speaker: "Jan Peters" },
  { title: "Cloud Security Basics", description: "Grundlagen sicherer Cloud-Architekturen fuer Entscheider.", durationMinutes: 60, session: 1, capacity: 15, room: "Raum E", speaker: "Sara Koch" },
  { title: "Nachhaltige IT", description: "Green IT und nachhaltige Softwarearchitektur.", durationMinutes: 60, session: 2, capacity: 15, room: "Raum F", speaker: "Paul Richter" },
  { title: "Design Thinking Intensiv", description: "Zweistuendiger Workshop zu nutzerzentrierter Innovation.", durationMinutes: 120, session: null, capacity: 20, room: "Raum G", speaker: "Mara Seidel" },
  { title: "Data & AI Deep Dive", description: "Intensiv-Workshop zu produktiven KI-Anwendungen im Unternehmen.", durationMinutes: 120, session: null, capacity: 1, room: "Raum H", speaker: "Dr. Elif Aydin" },
];

const participantRows = [
  { firstName: "Max", lastName: "Mustermann", email: "max.mustermann@example.com" },
  { firstName: "Sabine", lastName: "Meier", email: "sabine.meier@example.com" },
  { firstName: "Peter", lastName: "Beispiel", email: "peter.beispiel@example.com" },
  { firstName: "Julia", lastName: "Schmidt", email: "julia.schmidt@example.com" },
  { firstName: "Tim", lastName: "Wagner", email: "tim.wagner@example.com" },
  { firstName: "Anna", lastName: "Fischer", email: "anna.fischer@example.com" },
  { firstName: "Markus", lastName: "Klein", email: "markus.klein@example.com" },
  { firstName: "Laura", lastName: "Hoffmann", email: "laura.hoffmann@example.com" },
  { firstName: "Jonas", lastName: "Wolf", email: "jonas.wolf@example.com" },
  { firstName: "Nina", lastName: "Bauer", email: "nina.bauer@example.com" },
  { firstName: "Felix", lastName: "Neumann", email: "felix.neumann@example.com" },
  { firstName: "Petra", lastName: "Lang", email: "petra.lang@example.com" },
  { firstName: "Oliver", lastName: "Fuchs", email: "oliver.fuchs@example.com" },
];

async function main() {
  console.log("Lege Workshops an...");
  const now = Date.now();
  const workshopIdByTitle = new Map<string, string>();
  const allocWorkshops: AllocWorkshop[] = [];

  for (const def of workshopDefs) {
    const ref = db.collection("workshops").doc();
    await ref.set({
      title: def.title,
      description: def.description,
      imageUrl: null,
      durationMinutes: def.durationMinutes,
      session: def.session,
      capacity: def.capacity,
      confirmedCount: 0,
      waitlistCount: 0,
      room: def.room,
      speaker: def.speaker,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    workshopIdByTitle.set(def.title, ref.id);
    allocWorkshops.push({ id: ref.id, durationMinutes: def.durationMinutes, session: def.session, capacity: def.capacity });
  }
  const workshopsById = new Map(allocWorkshops.map((w) => [w.id, w]));

  console.log("Importiere Demo-Teilnehmer...");
  const participantIdByEmail = new Map<string, string>();
  for (const row of participantRows) {
    const ref = db.collection("participants").doc();
    const accessCode = generateAccessCode();
    await ref.set({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      accessCodeHash: hashAccessCode(accessCode),
      accessCodeEncrypted: encryptAccessCode(accessCode),
      createdAt: now,
      exported: false,
      exportedAt: null,
      registrationStatus: "imported",
    });
    participantIdByEmail.set(row.email, ref.id);
  }

  const scenarios: Array<{ email: string; preferenceTitles: string[] }> = [
    { email: "max.mustermann@example.com", preferenceTitles: ["KI im Einkauf", "Retail Innovation", "Future of Commerce"] },
    { email: "sabine.meier@example.com", preferenceTitles: ["KI im Einkauf", "Digitale Lieferketten", "Nachhaltige IT"] },
    { email: "peter.beispiel@example.com", preferenceTitles: ["KI im Einkauf", "Retail Innovation", "Nachhaltige IT"] },
    { email: "julia.schmidt@example.com", preferenceTitles: ["Future of Commerce", "Cloud Security Basics", "Nachhaltige IT"] },
    { email: "tim.wagner@example.com", preferenceTitles: ["Nachhaltige IT", "Digitale Lieferketten", "Retail Innovation"] },
    { email: "anna.fischer@example.com", preferenceTitles: ["Data & AI Deep Dive"] },
    { email: "markus.klein@example.com", preferenceTitles: ["Data & AI Deep Dive", "Design Thinking Intensiv"] },
    { email: "laura.hoffmann@example.com", preferenceTitles: ["Design Thinking Intensiv"] },
    { email: "jonas.wolf@example.com", preferenceTitles: ["Retail Innovation", "Future of Commerce", "KI im Einkauf"] },
    { email: "nina.bauer@example.com", preferenceTitles: ["Cloud Security Basics", "Digitale Lieferketten", "Nachhaltige IT"] },
    { email: "felix.neumann@example.com", preferenceTitles: ["Digitale Lieferketten", "Nachhaltige IT", "Future of Commerce"] },
    { email: "petra.lang@example.com", preferenceTitles: ["Digitale Lieferketten", "Cloud Security Basics", "Nachhaltige IT"] },
    {
      // Zeigt die neue gemischte Praeferenzliste: 1. Wunsch ein bereits ausgebuchter
      // 2-Stunden-Workshop, alternativ zwei 1-Stunden-Workshops - kein fester Track mehr.
      email: "oliver.fuchs@example.com",
      preferenceTitles: ["Data & AI Deep Dive", "Future of Commerce", "Cloud Security Basics"],
    },
  ];

  console.log("Simuliere Anmeldungen (sequenziell, First-Come-First-Served)...");
  for (const s of scenarios) {
    const participantId = participantIdByEmail.get(s.email)!;
    const preferences = s.preferenceTitles.map((t) => workshopIdByTitle.get(t)!);
    const allocParticipant: AllocParticipant = {
      participantId,
      preferences,
      submittedAt: Date.now(),
    };

    const bundles = enumerateBundles(allocParticipant, workshopsById);
    if (bundles.length === 0) {
      await db.collection("registrations").doc(participantId).set({
        participantId,
        preferences,
        submittedAt: Date.now(),
        updatedAt: Date.now(),
        status: "waitlisted",
        confirmedWorkshopIds: [],
      });
      console.log(`${s.email}: KONFLIKT - keine gueltige Kombination aus den Praeferenzen`);
      continue;
    }

    const fitting = bundles.find((b) =>
      b.workshopIds.every((id) => (workshopsById.get(id)!.capacity > (usage.get(id) ?? 0)))
    );

    if (fitting) {
      for (const id of fitting.workshopIds) {
        usage.set(id, (usage.get(id) ?? 0) + 1);
        await db.collection("workshops").doc(id).update({ confirmedCount: usage.get(id) });
      }
      await db.collection("registrations").doc(participantId).set({
        participantId,
        preferences,
        submittedAt: Date.now(),
        updatedAt: Date.now(),
        status: "confirmed",
        confirmedWorkshopIds: fitting.workshopIds,
      });
      const titles = fitting.workshopIds.map((id) => [...workshopIdByTitle.entries()].find(([, v]) => v === id)?.[0]);
      console.log(`${s.email}: bestaetigt (${titles.join(" + ")})`);
    } else {
      const desired = bundles[0];
      await db.collection("waitlistEntries").doc(participantId).set({
        participantId,
        workshopIds: desired.workshopIds,
        position: waitlistCounter++,
        createdAt: Date.now(),
      });
      await db.collection("registrations").doc(participantId).set({
        participantId,
        preferences,
        submittedAt: Date.now(),
        updatedAt: Date.now(),
        status: "waitlisted",
        confirmedWorkshopIds: [],
      });
      console.log(`${s.email}: Warteliste`);
    }
  }

  console.log("Fertig. Admin-Login separat via `npm run bootstrap-admin` einrichten.");
}

const usage = new Map<string, number>();
let waitlistCounter = 1;

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
