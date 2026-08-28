import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt } from "crypto";
import { env } from "@/lib/env";

// Crockford-Base32-Alphabet ohne 0/O/1/I/L - vermeidet Verwechslungen beim Abtippen.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Erzeugt einen kryptografisch zufaelligen Zugangscode im Format XXXX-XXXX (~40 Bit Entropie). */
export function generateAccessCode(): string {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** Trimmt, normalisiert Gross-/Kleinschreibung und entfernt alle Zeichen ausser dem Alphabet/Trennstrich. */
export function normalizeAccessCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

/** HMAC-SHA256(code, APP_HMAC_SECRET) - fuer die Login-Suche (schneller, exakter
 * Firestore-Query-Abgleich). Aus diesem Hash laesst sich der Code nicht zurueckrechnen. */
export function hashAccessCode(code: string): string {
  return createHmac("sha256", env.appHmacSecret).update(normalizeAccessCode(code)).digest("hex");
}

/**
 * Da die Anwendung Zugangscodes nicht selbst per Mail verschickt, sondern fuer einen
 * wiederholbaren XLSX-Export (Outlook-Serienmail) bereitstellen muss, kann der Code
 * nicht nur als Einweg-Hash gespeichert werden - er muss beim Export wiederherstellbar
 * sein. Statt Klartext wird er daher zusaetzlich AES-256-GCM-verschluesselt abgelegt
 * (separat vom Login-Hash) und nur serverseitig beim Export entschluesselt.
 */
export function encryptAccessCode(code: string): string {
  const key = Buffer.from(env.accessCodeEncryptionKey, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(normalizeAccessCode(code), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptAccessCode(encrypted: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  const key = Buffer.from(env.accessCodeEncryptionKey, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
