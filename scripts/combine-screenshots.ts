/**
 * Combine screenshots into a single PDF
 * Usage: npx tsx scripts/combine-screenshots.ts
 */

import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";

const DESKTOP = "/Users/david/Desktop";
const OUTPUT_DIR = "/Users/david/Downloads/materials";

// Use glob to find actual screenshot files
const screenshots = fs.readdirSync(DESKTOP)
  .filter(f => f.startsWith("Screenshot 2026-01-28") && f.endsWith(".png"))
  .sort();

async function main() {
  console.log("Creating PDF from screenshots...");

  // Create PDF with letter size pages
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: "letter",
  });

  const outputPath = path.join(OUTPUT_DIR, "ASTM-A923-Screenshots.pdf");
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  for (const screenshot of screenshots) {
    const imagePath = path.join(DESKTOP, screenshot);

    if (!fs.existsSync(imagePath)) {
      console.error(`Missing: ${screenshot}`);
      continue;
    }

    console.log(`Adding: ${screenshot}`);

    // Add a new page
    doc.addPage();

    // Fit image to page with margins
    const pageWidth = doc.page.width - 72; // 0.5 inch margins
    const pageHeight = doc.page.height - 72;

    doc.image(imagePath, 36, 36, {
      fit: [pageWidth, pageHeight],
      align: "center",
      valign: "center",
    });
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  console.log(`\nPDF created: ${outputPath}`);
}

main().catch(console.error);
