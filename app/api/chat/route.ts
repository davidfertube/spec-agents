import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchSimilarChunks, getDocumentById } from "@/lib/vectorstore";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Search for relevant chunks
    let chunks: Awaited<ReturnType<typeof searchSimilarChunks>> = [];
    try {
      chunks = await searchSimilarChunks(query, 5, 0.5);
    } catch {
      // If vector search fails (no documents indexed), continue with empty context
      console.log("No documents indexed yet or search failed");
    }

    // Get document names for citations
    const documentIds = [...new Set(chunks.map((c) => c.document_id))];
    const documents = await Promise.all(
      documentIds.map((id) => getDocumentById(id))
    );
    const docMap = new Map(documents.filter(Boolean).map((d) => [d!.id, d]));

    // Build context from chunks
    const context = chunks.length > 0
      ? chunks
          .map((chunk, index) => {
            const doc = docMap.get(chunk.document_id);
            return `[${index + 1}] From "${doc?.filename || "Unknown"}" (Page ${chunk.page_number}):\n${chunk.content}`;
          })
          .join("\n\n---\n\n")
      : "No documents have been uploaded yet.";

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemPrompt = `You are a senior materials engineer specializing in steel specifications, NACE/ASTM/API standards, and O&G compliance.

CRITICAL RULES:
1. ONLY answer based on the provided document context. Do NOT use external knowledge for specific values.
2. ALWAYS cite sources using [1], [2], etc. - every fact needs a citation.
3. For numerical values (yield strength, hardness, PREN), quote EXACTLY as written in the source.
4. If the context doesn't contain the answer, say: "This information is not in the uploaded documents."
5. Never hallucinate specifications or compliance requirements.

RESPONSE FORMAT:
**Answer:** [Direct answer with citations]

**Details:** [Supporting technical details from documents]

**Sources:** [List which documents were used]

EXAMPLE:
Q: "What is the yield strength of 316L stainless steel?"
A: **Answer:** The minimum yield strength of 316L is 170 MPa (25 ksi) [1].
**Details:** Per ASTM A240, 316L has lower carbon content (<0.03%) which reduces yield strength compared to 316 [1].
**Sources:** [1] ASTM_A240_Stainless_Steel.pdf, Page 3`;

    const userPrompt = chunks.length > 0
      ? `RETRIEVED DOCUMENT CONTEXT:
${context}

---
USER QUESTION: ${query}

Instructions: Answer ONLY using the context above. Cite every fact with [1], [2], etc. If the answer isn't in the context, say so.`
      : `USER QUESTION: ${query}

NOTE: No documents have been uploaded to the knowledge base yet.

Please provide general guidance based on industry standards (ASTM, NACE, API), but clearly state:
1. This is general knowledge, not from uploaded documents
2. User should upload relevant specification PDFs for verified, citable answers
3. Do not provide specific numerical values without document sources`;

    // Generate response
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt + "\n\n" + userPrompt }],
        },
      ],
    });

    const responseText = result.response.text();

    // Build sources array
    const sources = chunks.map((chunk, index) => {
      const doc = docMap.get(chunk.document_id);
      return {
        ref: `[${index + 1}]`,
        document: doc?.filename || "Unknown",
        page: String(chunk.page_number),
        content_preview: chunk.content.slice(0, 150) + "...",
      };
    });

    return NextResponse.json({
      response: responseText,
      sources,
    });
  } catch (error) {
    console.error("Chat error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check if it's an API key error
    if (errorMessage.includes("API key") || errorMessage.includes("API_KEY")) {
      return NextResponse.json({
        response: "Google Gemini API is not configured. Please add GOOGLE_API_KEY to your environment variables.",
        sources: [],
      });
    }

    // Security: Don't leak error details to client
    return NextResponse.json(
      { error: "Failed to process query" },
      { status: 500 }
    );
  }
}
