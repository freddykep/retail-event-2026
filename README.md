# Workshop-Buchungsplattform

Produktionsnahe Web-App für die Workshop-Anmeldung eines Business-Events: Teilnehmer melden
sich über einen individuellen, nicht erratbaren Zugangscode an und geben ihre
Workshop-Präferenzen ab; ein passwortgeschütztes Admin-Interface verwaltet Teilnehmerimport,
Workshops, den XLSX-Export für den Einladungsversand sowie die automatische und manuelle
Workshop-Zuteilung.

Stack: **Next.js (App Router) · TypeScript · Tailwind CSS · Firebase (Firestore + Authentication) ·
Vercel**. Die App verschickt **keine E-Mails selbst** – Einladungen werden als XLSX für einen
Outlook/Word-Seriendruck exportiert (siehe [Einladungen](#einladungen--serienmail-kein-eigener-mailversand)).

---

## Inhalt

- [Architektur auf einen Blick](#architektur-auf-einen-blick)
- [Lokale Einrichtung](#lokale-einrichtung)
- [Firebase-Setup](#firebase-setup)
- [Environment Variables](#environment-variables)
- [Einladungen / Serienmail](#einladungen--serienmail-kein-eigener-mailversand)
- [Der Zuteilungsalgorithmus](#der-zuteilungsalgorithmus)
- [Sicherheit](#sicherheit)
- [Datenschutz](#datenschutz)
- [Tests](#tests)
- [Deployment auf Vercel](#deployment-auf-vercel)
- [Bekannte Einschränkungen](#bekannte-einschränkungen--annahmen)

---

## Architektur auf einen Blick

```text
Admin importiert Teilnehmer (CSV)
        ↓
Zugangscodes werden automatisch erzeugt (Hash + verschlüsselt in Firestore)
        ↓
Admin exportiert Einladungen als XLSX
        ↓
Outlook/Word-Seriendruck (extern, außerhalb dieser App)
        ↓
Teilnehmer meldet sich mit Zugangscode an (/login)
        ↓
Teilnehmer gibt Workshop-Präferenzen ab -> Echtzeit-Buchung/Warteliste (Firestore-Transaktion)
        ↓
Admin schließt Anmeldephase, erstellt Zuteilungsvorschlag
        ↓
Admin prüft/passt manuell an, veröffentlicht
        ↓
Teilnehmer sieht finale Zuteilung (/result)
```

Wichtige Architekturentscheidung: **Firestore wird ausschließlich serverseitig** über das
Firebase Admin SDK angesprochen (Server Components, Server Actions, Route Handler). Der Browser
spricht nie direkt mit Firestore – die Firestore Security Rules verweigern deshalb jeden Zugriff
über das Client-SDK vollständig (`firestore.rules`), die gesamte Autorisierungslogik lebt in
`src/lib/auth/guards.ts` und den serverseitigen Modulen unter `src/lib/`.

Workshop-Bilder werden **nicht** über Firebase Storage verwaltet (das erfordert seit 2024 zwingend
den kostenpflichtigen Blaze-Tarif) – stattdessen liegt eine feste, kleine Bild-Galerie als Asset im
Repo (`public/workshop-images/`, Manifest in `src/lib/workshop-images.ts`), aus der der Admin beim
Anlegen eines Workshops auswählt.

Wichtige Ordner:

```text
src/lib/allocation/    reine Zuteilungslogik (keine Firestore-Abhängigkeit, testbar)
src/lib/auth/          Zugangscode-Krypto, Teilnehmer-/Admin-Sessions, Rate-Limiting
src/lib/firestore/     Firestore-Repositories (nur serverseitig, "server-only")
src/lib/import/        CSV-Import & Validierung
src/lib/export/        CSV-/XLSX-Export
src/app/actions/       Next.js Server Actions (Formular-Mutationen)
src/app/(Teilnehmer)   /login, /workshops, /result
src/app/admin/         /admin/login (öffentlich) + /admin/(protected)/* (Dashboard, Teilnehmer,
                       Workshops, Zuteilung)
scripts/               Einmalige Setup-/Demo-Skripte (bootstrap-admin, seed)
```

---

## Lokale Einrichtung

Voraussetzungen: **Node.js 20+**, npm.

```bash
npm install
cp .env.local.example .env.local   # Werte eintragen, siehe unten
npm run dev
```

Die App läuft danach unter `http://localhost:3000` (Teilnehmerbereich) bzw.
`http://localhost:3000/admin` (Admin, siehe [Firebase-Setup](#firebase-setup) für den ersten
Admin-Zugang).

---

## Firebase-Setup

1. Firebase-Projekt anlegen unter <https://console.firebase.google.com>.
2. **Firestore** aktivieren (Native Mode, beliebige Region).
3. **Storage** aktivieren (für Workshop-Bilder).
4. **Authentication** aktivieren, Anmeldemethode **E-Mail/Passwort** einschalten (wird nur für
   Admins genutzt).
5. Service-Account-Schlüssel erzeugen: *Projekteinstellungen → Dienstkonten → Neuen privaten
   Schlüssel generieren* → JSON-Datei herunterladen. Daraus `FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` in `.env.local` übernehmen.
6. Web-App-Konfiguration (für den Admin-Login im Browser) unter *Projekteinstellungen → Deine
   Apps → Web-App hinzufügen* erzeugen → `NEXT_PUBLIC_FIREBASE_*`-Variablen übernehmen.
7. Firebase CLI installieren und Projekt verbinden:
   ```bash
   npx firebase login
   npx firebase use --add   # Projekt auswählen
   ```
8. Security Rules deployen:
   ```bash
   npx firebase deploy --only firestore:rules,storage
   ```
9. Ersten Admin-Benutzer anlegen: `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD` in
   `.env.local` setzen, dann:
   ```bash
   npm run bootstrap-admin
   ```
   Danach die beiden `ADMIN_BOOTSTRAP_*`-Variablen wieder aus `.env.local` entfernen.
10. Optional: Demo-Daten laden (8 Workshops, 12 Teilnehmer, realistische Anmeldeszenarien inkl.
    Warteliste/Konflikt):
    ```bash
    npm run seed
    ```

---

## Environment Variables

Siehe `.env.local.example` für die vollständige, kommentierte Liste. Kurzüberblick:

| Variable | Zweck |
| --- | --- |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK (Server) |
| `FIREBASE_STORAGE_BUCKET` | Storage-Bucket für Workshop-Bilder |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Web SDK, nur für den Admin-Login im Browser (keine Secrets) |
| `APP_HMAC_SECRET` | Schlüssel für den Zugangscode-Hash (Login-Suche) |
| `SESSION_SECRET` | Schlüssel für das Teilnehmer-Session-Cookie (JWT) |
| `ACCESS_CODE_ENCRYPTION_KEY` | 32-Byte-Hex-Schlüssel (AES-256-GCM) für den wiederholbaren XLSX-Export |
| `NEXT_PUBLIC_APP_URL` | Basis-URL, erscheint als (nicht-personalisierter) Anmeldelink im Export |
| `ADMIN_BOOTSTRAP_EMAIL` / `_PASSWORD` | Nur für `npm run bootstrap-admin`, danach entfernen |

**Nie echte Secrets in Git committen.** `.env.local` ist per `.gitignore` ausgeschlossen.

---

## Einladungen / Serienmail (kein eigener Mailversand)

Die App verschickt bewusst **keine E-Mails selbst** (keine Anbindung an Resend, SendGrid,
Microsoft Graph o.ä.) und benötigt daher keine Berechtigungen für ein unternehmensinternes
Mailsystem. Stattdessen exportiert der Admin unter **Teilnehmer → Einladungen/Serienmail** eine
XLSX-Datei mit den Spalten `Vorname, Nachname, E-Mail, Zugangscode, Anmeldelink` – der Anmeldelink
ist für alle Zeilen identisch (`NEXT_PUBLIC_APP_URL`), die Zuordnung erfolgt ausschließlich über
den individuellen Zugangscode. Diese Datei wird extern per Outlook/Word-Seriendruck personalisiert
verschickt (Spalten sind direkt als Seriendruckfelder nutzbar).

Zwei Export-Modi (`GET /api/admin/export/invitations?onlyNotExported=true|false`):
- **Nur nicht-exportierte Teilnehmer** (Standard) – für den laufenden Betrieb.
- **Alle erneut exportieren** – z.B. wenn die Serienmail wiederholt werden muss.

Da der Zugangscode dafür wiederholt exportierbar sein muss, kann er nicht nur als Einweg-Hash
gespeichert werden (siehe [Sicherheit](#sicherheit)).

---

## Der Zuteilungsalgorithmus

Reine, Firestore-unabhängige Funktionen in `src/lib/allocation/` (`bundles.ts`, `scoring.ts`,
`validate.ts`, `allocate.ts`, `allocate-fcfs.ts`, `repair.ts`) – vollständig unit-getestet in
`allocate.test.ts` / `allocate-fcfs.test.ts`.

1. **Buchung in Echtzeit** (`submitRegistration`, `src/lib/firestore/registrations.ts`): Beim
   Absenden der Präferenzen versucht der Server sofort transaktional, das bestbewertete
   verfügbare Workshop-Bündel zu reservieren (First-Come-First-Served, race-condition-sicher
   durch eine Firestore-Transaktion, die Kapazität und eine ggf. vorhandene eigene
   Registrierung atomar prüft). Ist keine Kombination verfügbar, kommt der Teilnehmer auf die
   Warteliste (als ganzes Bündel, mit stabiler, atomar vergebener Position).
2. **Bundle-Bildung** (`bundles.ts`): Es gibt keinen vorab gewählten "Track" – Teilnehmer wählen
   auf einer einzigen Übersichtsseite frei aus allen Workshops (siehe §7), die Präferenzliste kann
   60- und 120-Minuten-Workshops mischen (z.B. "1. Wunsch: ausgebuchter 2-Stunden-Workshop,
   Alternative: zwei 1-Stunden-Workshops"). Jede 120-Minuten-Präferenz ist für sich ein Bündel;
   für 60 Minuten werden alle **ungeordneten Paare** aus den Präferenzen gebildet, deren Workshops
   in **unterschiedlichen Sessions** liegen (das ist die eigentliche Gültigkeitsregel – der
   Teilnehmer kennt die Sessions nicht, das System ermittelt die beste Kombination automatisch).
3. **Automatischer Zuteilungsvorschlag** (`allocate.ts`, ausgelöst durch den Admin nach
   Anmeldeschluss): Score = 1./2./3. Präferenz = 100/60/30 Punkte, bei 60+60 die Summe beider
   gewählter Präferenzen.
   - **Greedy-Pass**: globale Kandidatenliste (Teilnehmer × Bündel) nach Score absteigend
     sortiert, `submittedAt` (FCFS) nur als **Tiebreak**. Damit können späte Teilnehmer mit
     verfügbaren Wünschen frühe Teilnehmer mit überlaufenen Wünschen überholen – bewusst **kein**
     reines Serial-Dictatorship-by-arrival, das frühe Teilnehmer systematisch bevorzugen würde.
   - **Swap-Repair-Pass** (`repair.ts`): reines Greedy kann Kapazität blockieren, die zwei andere
     Teilnehmer vollständig versorgen würde. Für unversorgte Teilnehmer wird deshalb geprüft, ob
     ein bereits zugeteilter Teilnehmer verdrängt werden kann – aber **nur**, wenn dieser selbst
     vollständig auf ein anderes gültiges Bündel umgesetzt werden kann. Nettoeffekt: ein
     zusätzlicher Teilnehmer wird versorgt, niemand verliert seine Vollversorgung, Kapazität wird
     nie verletzt.
   - Verbleibend Unversorgte landen in FCFS-Reihenfolge auf der Warteliste; Teilnehmer, aus deren
     Präferenzen sich gar keine gültige Kombination bilden lässt (z.B. alle drei Wünsche in
     derselben Session), werden explizit als **Konflikt** markiert statt stillschweigend
     verworfen.
   - Bewusst **kein** Gale-Shapley/Deferred-Acceptance (optimiert Stabilität, nicht
     Gesamtzufriedenheit/Vollversorgung) und **keine** ILP-/Min-Cost-Flow-Lösung (für die
     Eventgröße überdimensioniert und schwerer nachvollziehbar). Greedy+Swap-Repair ist ein
     bewusster, dokumentierter, nachvollziehbarer Kompromiss.
4. Ergebnis landet als **Entwurf** (`draftAssignments`, nicht sichtbar für Teilnehmer). Der Admin
   kann jede Zuteilung manuell überschreiben (erneute Validierung von Workshop-Typ,
   Session-Kombination und verbleibender Kapazität bei jeder Änderung) und veröffentlicht dann
   explizit – erst danach sehen Teilnehmer ihr Ergebnis unter `/result`.

### Zwei admin-wählbare Zuteilungsmodi

Unter **Admin → Zuteilung** lässt sich vor Erstellung des Zuteilungsvorschlags (am besten schon
vor Öffnung der Anmeldephase) zwischen zwei Modi wählen (`event/config.allocationMode`):

- **Fair (mit Ausgleich)** – Standard, oben beschrieben: Score entscheidet, `submittedAt` nur als
  Tiebreak, mit Swap-Repair-Ausgleich.
- **Striktes First-Come-First-Served** (`allocate-fcfs.ts`) – ignoriert den Score vollständig.
  Teilnehmer werden ausschließlich nach Anmeldezeitpunkt verarbeitet; jeder bekommt sein
  bestbewertetes zu diesem Zeitpunkt verfügbares Bündel aus den **eigenen** Präferenzen, ohne
  Swap-Repair. Einmal vergebene Buchungen werden nie durch spätere Teilnehmer verdrängt – dafür
  können frühe Teilnehmer mit ungünstigen Wünschen spätere mit besser verfügbaren Wünschen
  blockieren (der bewusste Kompromiss dieses Modus).

**Atomaritäts-Garantie (gilt für beide Modi):** Ein Teilnehmer erhält am Ende immer entweder sein
komplettes gewünschtes Bündel (1× 120 Minuten oder 2× 60 Minuten) oder landet komplett auf der
Warteliste – **nie** nur einen Teil einer 60+60-Kombination. Das liegt daran, dass Bündel im
gesamten Algorithmus (Greedy-Pass, Swap-Repair, striktes FCFS) immer als unteilbare Einheit
behandelt werden: `bundleFits`/`commitBundle` prüfen und reservieren stets alle Workshops eines
Bündels gemeinsam, und ein Swap wird vollständig zurückgerollt, wenn der verdrängte Teilnehmer
keine vollwertige Alternative bekommt (siehe `repair.ts`). Explizit abgesichert durch die Tests
"garantiert: wer nur EINE Präferenz angibt..." und "...bekommt NIE nur einen davon" in
`allocate.test.ts`.

---

## Sicherheit

- **Teilnehmer-Authentifizierung**: kein gemeinsames Passwort. Jeder Teilnehmer erhält einen
  kryptografisch zufälligen Zugangscode (`XXXX-XXXX`, Crockford-Base32-Alphabet ohne
  verwechselbare Zeichen, ~40 Bit Entropie). Gespeichert wird ausschließlich
  `HMAC-SHA256(Code, APP_HMAC_SECRET)` für die Login-Suche – der Klartext-Code ist daraus nicht
  rekonstruierbar. Da die App den Code aber für einen **wiederholbaren XLSX-Export** bereitstellen
  muss (kein eigener Mailversand, siehe oben), wird zusätzlich eine **AES-256-GCM-verschlüsselte**
  Kopie gespeichert, die nur serverseitig beim Export entschlüsselt wird – nirgendwo liegt der
  Code im Klartext. Nach erfolgreicher Prüfung erhält der Teilnehmer ein signiertes,
  HttpOnly-Session-Cookie (JWT, `SESSION_SECRET`).
- **Identität**: Vorname/Nachname/E-Mail stammen ausschließlich aus dem importierten
  Teilnehmerdatensatz und sind für den Teilnehmer nicht änderbar – die Identität wird
  ausschließlich über die serverseitig verifizierte `participantId` bestimmt.
- **Rate-Limiting**: Firestore-gestützter Versuchszähler pro IP für Code-Eingaben
  (`src/lib/auth/rate-limit.ts`), best-effort innerhalb einer serverlosen Umgebung – für hohen
  Traffic zusätzlich ein Edge-Rate-Limiting (z.B. Vercel/Upstash) ergänzen.
- **Admin-Authentifizierung**: Firebase Authentication + Custom Claim `role: admin`
  (`scripts/bootstrap-admin.ts`), geprüft serverseitig bei jedem Seitenaufruf/jeder Server Action
  (`requireAdmin()` / `requireAdminApi()`), nicht nur durch Verstecken der Route.
- **Firestore/Storage**: siehe [Architektur](#architektur-auf-einen-blick) – Zugriff nur
  serverseitig, Security Rules verweigern jeden Client-Zugriff vollständig.
- **Keine Secrets im Client-Bundle**, keine Zugangscodes in Logs.

Bekannter Hinweis: Das npm-Paket `xlsx` (SheetJS) hat offene Sicherheitshinweise, die beim
**Parsen nicht vertrauenswürdiger Dateien** greifen (Prototype Pollution / ReDoS). Diese App nutzt
`xlsx` ausschließlich zum **Schreiben** von Dateien aus eigenen, vertrauenswürdigen Daten
(`XLSX.write`/`json_to_sheet`), liest also nie fremde XLSX-Dateien ein – die Angriffsfläche der
bekannten Advisories ist damit nicht gegeben. Vor einem produktiven Einsatz trotzdem `npm audit`
prüfen.

---

## Datenschutz

Es werden ausschließlich die für die Workshop-Anmeldung notwendigen personenbezogenen Daten
gespeichert (Vorname, Nachname, E-Mail, Anmeldezeitpunkt, Präferenzen, Zuteilung). Für den
produktiven Einsatz zusätzlich klären:

- Datenschutzinformation für Teilnehmer (Art. 13 DSGVO) – wer verarbeitet die Daten, zu welchem
  Zweck, wie lange.
- Aufbewahrungsfristen / Löschkonzept nach Abschluss des Events.
- Ggf. Auftragsverarbeitungsvertrag mit dem Firebase-/Vercel-Betreiber.
- Löschbarkeit einzelner Teilnehmer ist technisch durch Löschen der jeweiligen
  Firestore-Dokumente (`participants`, `registrations`, `waitlistEntries`, `assignments`)
  möglich.

---

## Tests

```bash
npm run test        # Vitest: Allocation-Algorithmus, Bundle-Bildung, CSV-Import
npm run test:watch
```

Abgedeckt sind u.a.: gültige/ungültige 60+60- und 120-Kombinationen, Kapazitätsgrenzen,
Fairness (kein reines Serial-Dictatorship), Swap-Repair, Konflikterkennung, CSV-Validierung
(Pflichtfelder, ungültige E-Mails, Duplikate). Für Firestore-Transaktionen/Security Rules
zusätzlich die Firebase Emulator Suite nutzen:

```bash
npx firebase emulators:start
```

---

## Deployment auf Vercel

1. Repository auf GitHub pushen.
2. In Vercel *New Project* → GitHub-Repository auswählen.
3. Alle Variablen aus `.env.local.example` in den Vercel-Projekteinstellungen unter
   *Environment Variables* eintragen (`FIREBASE_PRIVATE_KEY` inkl. der `\n`-Zeilenumbrüche als
   literale Zeichenfolge, in Anführungszeichen).
4. `NEXT_PUBLIC_APP_URL` auf die endgültige Vercel-URL setzen (z.B.
   `https://workshop-event.vercel.app`).
5. Deploy auslösen. Danach `npm run bootstrap-admin` **lokal** gegen dasselbe Firebase-Projekt
   ausführen, um den ersten Admin-Zugang anzulegen.
6. Firestore Security Rules deployen (`npx firebase deploy --only firestore:rules`), falls noch
   nicht geschehen.

---

## Bekannte Einschränkungen / Annahmen

- Teilnehmer sehen alle Workshops auf einer einzigen Übersichtsseite (Kacheln: Bild links, Titel/
  Beschreibung/Status rechts, Bild in einem Layer vergrößerbar) und wählen per Klick, ohne vorab
  einen "Track" festzulegen. Die Oberfläche blendet abhängig von der aktuellen Auswahl inkompatible
  Workshops aus (`src/lib/participant-selection.ts`): ein freier 2-Stunden-Workshop blendet sofort
  alles andere aus (Fast-Path, 1 Präferenz genügt); ein bereits ausgebuchter 2-Stunden-Workshop
  verlangt eine Alternative (ein weiterer 2-Stunden-Workshop **oder** zwei 1-Stunden-Workshops);
  ein 1-Stunden-Workshop blendet 2-Stunden-Workshops aus. Maximal 3 Präferenzen insgesamt.
  **Pflicht-3. Präferenz:** Sobald mindestens ein 1-Stunden-Workshop beteiligt ist (reiner
  60er-Pfad oder voller 2-Stunden-Erstwunsch + 60+60-Alternative), verlangt die Oberfläche eine
  dritte Präferenz als zusätzliche Absicherung gegen Warteliste bei der finalen Zuteilung (siehe
  [Zuteilungsalgorithmus](#der-zuteilungsalgorithmus)) – außer es existieren insgesamt weniger als
  3 passende Workshops. Bei reinen 2-Stunden-Alternativen zueinander genügt dagegen ein einziger
  weiterer Workshop (2 insgesamt), da das bereits eine vollständige Alternative darstellt. Diese
  Regel kann das Risiko, bei echter Kapazitätsknappheit auf der Warteliste zu landen, verringern,
  aber – wie jedes kapazitätsbeschränkte Zuteilungsproblem – nicht vollständig ausschließen: reicht
  die Gesamtkapazität der von Teilnehmern gewählten Workshops nicht für alle aus, ist eine
  Warteliste unvermeidlich (dafür ist sie da).
- 60-Minuten-Workshops erhalten im Admin-Formular eine Pflicht-Session (1 oder 2); 120-Minuten-
  Workshops benötigen keine, da sie automatisch beide Sessions belegen.
- Rate-Limiting ist Firestore-basiert und best-effort; für sehr hohen Traffic zusätzliches
  Edge-Rate-Limiting ergänzen.
- `registrations` nutzt die `participantId` als Dokument-ID (verhindert Doppelanmeldungen
  strukturell und schützt den ursprünglichen FCFS-Zeitstempel bei Änderungen).
