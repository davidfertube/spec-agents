/**
 * OCR for Scanned PDFs using Gemini Vision
 * =========================================
 *
 * Uses Google's Gemini 1.5 Flash multimodal model to extract text
 * from scanned PDFs by converting pages to images and processing
 * them with vision capabilities.
 *
 * This allows processing of scanned documents that unpdf cannot handle.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

// Gemini model with vision capabilities
const VISION_MODEL = "gemini-1.5-flash";

/**
 * Extract text from a PDF using Gemini's vision capabilities
 *
 * This is used as a fallback when unpdf fails to extract text
 * (typically for scanned documents).
 *
 * @param pdfBuffer - The PDF file as ArrayBuffer
 * @returns Extracted text from all pages
 */
export async function extractTextWithOCR(pdfBuffer: ArrayBuffer): Promise<string> {
  const model = genAI.getGenerativeModel({ model: VISION_MODEL });

  // Convert ArrayBuffer to base64
  const base64 = Buffer.from(pdfBuffer).toString("base64");

  console.log("[OCR] Starting Gemini Vision text extraction...");

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64,
        },
      },
      {
        text: `You are a document OCR system. Extract ALL text from this PDF document.

Instructions:
- Extract every piece of text visible in the document
- Preserve the structure and formatting as much as possible
- Include table data, headers, footers, and any text in images
- Do not summarize or interpret - just extract the raw text
- If there are multiple pages, extract text from all of them
- Separate pages with "---PAGE BREAK---"

Output only the extracted text, nothing else.`,
      },
    ]);

    const response = result.response;
    const text = response.text();

    console.log(`[OCR] Successfully extracted ${text.length} characters`);

    return text;
  } catch (error) {
    console.error("[OCR] Gemini Vision extraction failed:", error);
    throw error;
  }
}

/**
 * Check if OCR should be attempted for a document
 *
 * @param originalText - Text from unpdf extraction
 * @param fileSize - Size of the PDF file in bytes
 * @returns true if OCR should be attempted
 */
export function shouldAttemptOCR(originalText: string, fileSize: number): boolean {
  // If unpdf got significant text, no need for OCR
  if (originalText.trim().length > 100) {
    return false;
  }

  // If file is very small, it might just be an empty/blank PDF
  if (fileSize < 1000) {
    return false;
  }

  // File has content but unpdf couldn't extract - likely scanned
  return true;
}
