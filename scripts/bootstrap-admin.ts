/**
 * Einmaliges Setup-Skript: legt einen Firebase-Auth-Benutzer an (oder aktualisiert ihn)
 * und setzt den Custom Claim `role: admin`, der fuer den Zugriff auf /admin
 * erforderlich ist (siehe lib/auth/admin-session.ts). Danach ADMIN_BOOTSTRAP_* aus
 * .env.local wieder entfernen.
 *
 * Aufruf: npm run bootstrap-admin
 */
import { config } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

config({ path: ".env.local", quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Fehlende Umgebungsvariable: ${name}`);
  return value;
}

async function main() {
  const email = required("ADMIN_BOOTSTRAP_EMAIL");
  const password = required("ADMIN_BOOTSTRAP_PASSWORD");

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: required("FIREBASE_PROJECT_ID"),
          clientEmail: required("FIREBASE_CLIENT_EMAIL"),
          privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
        }),
      });

  const auth = getAuth(app);

  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password });
    console.log(`Bestehender Benutzer aktualisiert: ${email}`);
  } catch {
    user = await auth.createUser({ email, password });
    console.log(`Neuer Benutzer angelegt: ${email}`);
  }

  await auth.setCustomUserClaims(user.uid, { role: "admin" });
  console.log(`Custom Claim role=admin gesetzt fuer ${email} (uid: ${user.uid})`);
  console.log("Wichtig: ADMIN_BOOTSTRAP_EMAIL/PASSWORD danach aus .env.local entfernen.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
