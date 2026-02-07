/**
 * Document Deduplication Script
 *
 * Identifies duplicate documents in Supabase and removes older copies,
 * keeping only the most recently indexed version of each unique spec.
 *
 * This fixes search noise caused by the same spec being uploaded 4-8 times.
 *
 * Usage:
 *   npx tsx scripts/dedup-documents.ts          # Dry run (show what would be deleted)
 *   npx tsx scripts/dedup-documents.ts --apply  # Actually delete duplicates
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DocRecord {
  id: number;
  filename: string;
  storage_path: string;
  file_size: number;
  status: string;
  created_at: string;
  chunk_count?: number;
}

/**
 * Normalize filename to identify duplicates.
 * "ASTM A789 Seamless & Welded Duplex Tubing For General Service 2014.pdf"
 * and "ASTM A789 Seamless & Welded Duplex Stainless Steel Tubing 2013.pdf"
 * are DIFFERENT specs (different years/editions), so we group by exact filename.
 */
function normalizeFilename(filename: string): string {
  return filename.trim().toLowerCase();
}

async function main() {
  const dryRun = !process.argv.includes("--apply");

  console.log("=".repeat(70));
  console.log("  DOCUMENT DEDUPLICATION");
  console.log(`  Mode: ${dryRun ? "DRY RUN (use --apply to delete)" : "APPLY (will delete duplicates)"}`);
  console.log("=".repeat(70));
  console.log();

  // 1. Fetch all documents
  const { data: docs, error: docErr } = await supabase
    .from("documents")
    .select("id, filename, storage_path, file_size, status, created_at")
    .order("id");

  if (docErr || !docs) {
    console.error("Error:", docErr);
    return;
  }

  // 2. Get chunk counts
  for (const doc of docs) {
    const { count } = await supabase
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", doc.id);
    (doc as DocRecord).chunk_count = count || 0;
  }

  // 3. Group by normalized filename
  const groups = new Map<string, DocRecord[]>();
  for (const doc of docs as DocRecord[]) {
    const key = normalizeFilename(doc.filename);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(doc);
  }

  // 4. Identify duplicates
  let totalDuplicates = 0;
  let totalChunksToDelete = 0;
  const toKeep: DocRecord[] = [];
  const toDelete: DocRecord[] = [];

  for (const [filename, copies] of groups) {
    if (copies.length === 1) {
      toKeep.push(copies[0]);
      continue;
    }

    // Keep the copy with the most chunks (best indexed version)
    // Tie-break by most recent creation date
    copies.sort((a, b) => {
      if ((b.chunk_count || 0) !== (a.chunk_count || 0)) {
        return (b.chunk_count || 0) - (a.chunk_count || 0);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const keep = copies[0];
    const dupes = copies.slice(1);

    toKeep.push(keep);
    toDelete.push(...dupes);
    totalDuplicates += dupes.length;
    totalChunksToDelete += dupes.reduce((sum, d) => sum + (d.chunk_count || 0), 0);

    console.log(`  "${filename}" — ${copies.length} copies`);
    console.log(`    KEEP:   ID=${keep.id} (${keep.chunk_count} chunks, ${new Date(keep.created_at).toLocaleDateString()})`);
    for (const dupe of dupes) {
      console.log(`    DELETE: ID=${dupe.id} (${dupe.chunk_count} chunks, ${new Date(dupe.created_at).toLocaleDateString()})`);
    }
    console.log();
  }

  console.log("-".repeat(70));
  console.log(`  Unique specs:     ${groups.size}`);
  console.log(`  Documents to keep: ${toKeep.length}`);
  console.log(`  Duplicates to delete: ${totalDuplicates}`);
  console.log(`  Chunks to delete:    ${totalChunksToDelete}`);
  console.log();

  if (toDelete.length === 0) {
    console.log("  No duplicates found!");
    return;
  }

  if (dryRun) {
    console.log("  This was a DRY RUN. To apply, run:");
    console.log("    npx tsx scripts/dedup-documents.ts --apply");
    return;
  }

  // 5. Delete duplicates (chunks cascade via FK)
  console.log("  Deleting duplicates...");

  for (const doc of toDelete) {
    // Delete chunks first (CASCADE should handle this but be explicit)
    const { error: chunkErr } = await supabase
      .from("chunks")
      .delete()
      .eq("document_id", doc.id);

    if (chunkErr) {
      console.error(`  Error deleting chunks for doc ${doc.id}:`, chunkErr);
      continue;
    }

    // Delete document record
    const { error: docDelErr } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);

    if (docDelErr) {
      console.error(`  Error deleting doc ${doc.id}:`, docDelErr);
      continue;
    }

    // Delete from storage bucket
    const { error: storageErr } = await supabase
      .storage
      .from("documents")
      .remove([doc.storage_path]);

    if (storageErr) {
      console.warn(`  Warning: couldn't delete storage file ${doc.storage_path}:`, storageErr.message);
    }

    console.log(`  Deleted doc ${doc.id} (${doc.filename}) — ${doc.chunk_count} chunks removed`);
  }

  console.log();
  console.log(`  Done! Deleted ${toDelete.length} duplicate documents and ${totalChunksToDelete} chunks.`);
  console.log(`  Remaining: ${toKeep.length} unique documents.`);
}

main().catch(console.error);
