import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateEmbeddings } from "@/lib/embeddings";
import { storeChunks } from "@/lib/vectorstore";
import { extractText } from "unpdf";

// Split text into chunks of ~500 tokens with overlap
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start < 0) start = 0;
    if (end === text.length) break;
  }

  return chunks.filter((chunk) => chunk.trim().length > 50);
}

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID required" },
        { status: 400 }
      );
    }

    // Get document from database
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Update status to processing
    await supabase
      .from("documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return NextResponse.json(
        { error: "Failed to download document" },
        { status: 500 }
      );
    }

    // Parse PDF using unpdf
    const arrayBuffer = await fileData.arrayBuffer();
    const { text } = await extractText(arrayBuffer, { mergePages: true });

    if (!text || text.trim().length === 0) {
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return NextResponse.json(
        { error: "Could not extract text from PDF" },
        { status: 400 }
      );
    }

    // Chunk the text
    const textChunks = chunkText(text);

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(textChunks);

    // Store chunks with embeddings
    const chunks = textChunks.map((content, index) => ({
      document_id: documentId,
      content,
      page_number: Math.floor(index / 3) + 1, // Rough page estimate
      embedding: embeddings[index],
    }));

    await storeChunks(chunks);

    // Update status to indexed
    await supabase
      .from("documents")
      .update({ status: "indexed" })
      .eq("id", documentId);

    return NextResponse.json({
      success: true,
      chunks: chunks.length,
      message: `Processed ${chunks.length} chunks from document`,
    });
  } catch (error) {
    console.error("Process error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to process document", details: errorMessage },
      { status: 500 }
    );
  }
}
