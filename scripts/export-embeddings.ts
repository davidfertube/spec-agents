/**
 * Export Embeddings for Arize Phoenix Visualization
 *
 * Exports all chunk embeddings + metadata from Supabase to a JSONL file
 * that can be loaded into Phoenix UI for 2D/3D embedding visualization.
 *
 * Usage: npm run phoenix:export
 *
 * This helps diagnose retrieval quality issues:
 * - See which chunks cluster together in vector space
 * - Identify cross-document contamination (e.g., A872 near 5CT)
 * - Spot outlier chunks that may be poorly embedded
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ChunkRow {
  id: number;
  document_id: number;
  content: string;
  page_number: number;
  embedding: number[];
  section_title: string | null;
  chunk_type: string | null;
  has_codes: boolean;
  confidence: number | null;
  documents: { filename: string } | null;
}

async function exportEmbeddings() {
  console.log("Fetching chunks with embeddings from Supabase...");

  // Fetch chunks with document names
  const { data: chunks, error } = await supabase
    .from("chunks")
    .select(`
      id,
      document_id,
      content,
      page_number,
      embedding,
      section_title,
      chunk_type,
      has_codes,
      confidence,
      documents!inner(filename)
    `)
    .not("embedding", "is", null)
    .order("document_id")
    .order("page_number");

  if (error) {
    console.error("Failed to fetch chunks:", error);
    process.exit(1);
  }

  if (!chunks || chunks.length === 0) {
    console.log("No chunks with embeddings found.");
    return;
  }

  console.log(`Found ${chunks.length} chunks across documents.`);

  // Write JSONL file
  const outputPath = path.join(process.cwd(), "reports", "embeddings-export.jsonl");

  // Ensure reports directory exists
  const reportsDir = path.dirname(outputPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const writeStream = fs.createWriteStream(outputPath);

  const docCounts: Record<string, number> = {};

  for (const chunk of chunks as unknown as ChunkRow[]) {
    const docName = chunk.documents?.filename || "Unknown";
    docCounts[docName] = (docCounts[docName] || 0) + 1;

    const record = {
      id: chunk.id,
      document_id: chunk.document_id,
      document_name: docName,
      page_number: chunk.page_number,
      chunk_type: chunk.chunk_type || "text",
      section_title: chunk.section_title || "",
      has_codes: chunk.has_codes,
      confidence: chunk.confidence,
      content_preview: chunk.content.slice(0, 200).replace(/\n/g, " "),
      embedding: chunk.embedding,
    };

    writeStream.write(JSON.stringify(record) + "\n");
  }

  writeStream.end();

  console.log(`\nExported to: ${outputPath}`);
  console.log(`\nPer-document breakdown:`);
  for (const [doc, count] of Object.entries(docCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${doc}: ${count} chunks`);
  }

  console.log(`\nTo visualize in Phoenix:`);
  console.log(`  1. pip install arize-phoenix`);
  console.log(`  2. phoenix serve`);
  console.log(`  3. Open http://localhost:6006`);
  console.log(`  4. Import ${outputPath}`);
}

exportEmbeddings().catch(console.error);
