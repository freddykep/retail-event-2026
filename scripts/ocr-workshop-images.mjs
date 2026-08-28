// Einmaliges Offline-Tool: liest den Text aus den fest hinterlegten Workshop-Bildern
// (public/workshop-images/*.jpg) per OCR aus und schreibt eine strukturierte Vorschau
// nach scripts/_ocr-output.json. Diese Datei wird danach manuell geprueft/bereinigt und
// als Grundlage fuer src/lib/workshop-image-info.ts verwendet (siehe dort).
//
// Erneut ausfuehren, wenn ein neues Bild zur festen Galerie hinzugefuegt wird:
//   node scripts/ocr-workshop-images.mjs
import { createWorker } from "tesseract.js";
import { readdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, "..", "public", "workshop-images");

async function main() {
  const worker = await createWorker("deu");
  const files = readdirSync(imagesDir).filter((f) => f.endsWith(".jpg"));
  const output = {};

  for (const file of files) {
    const id = file.replace(/\.jpg$/, "");
    console.log(`\n=== OCR: ${file} ===`);
    const { data } = await worker.recognize(path.join(imagesDir, file), {}, { blocks: true });
    const lines = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          lines.push({
            y: Math.round((line.bbox.y0 + line.bbox.y1) / 2),
            height: line.bbox.y1 - line.bbox.y0,
            x0: line.bbox.x0,
            text: line.text.trim(),
          });
        }
      }
    }
    lines.sort((a, b) => a.y - b.y);
    output[id] = lines;
    console.log(lines.map((l) => `  [y=${l.y} h=${l.height} x=${l.x0}] ${l.text}`).join("\n"));
  }

  await worker.terminate();
  writeFileSync(path.join(__dirname, "_ocr-output.json"), JSON.stringify(output, null, 2));
  console.log("\nGeschrieben nach scripts/_ocr-output.json");
}

main();
