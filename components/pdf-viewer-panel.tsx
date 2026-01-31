"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker - use unpkg which serves all npm package versions
// Note: cdnjs only has up to v5.4.149, but pdfjs-dist is v5.4.530
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PDFViewerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  pageNumber: number;
  highlightText?: string;
  documentName?: string;
}

export function PDFViewerPanel({
  isOpen,
  onClose,
  pdfUrl,
  pageNumber,
  highlightText,
  documentName,
}: PDFViewerPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load PDF document
  useEffect(() => {
    if (!pdfUrl || !isOpen) return;

    setIsLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(Math.min(pageNumber, pdf.numPages));
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError("Failed to load PDF document");
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();

    return () => {
      setPdfDoc(null);
    };
  }, [pdfUrl, isOpen, pageNumber]);

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.render as any)({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Render text layer for highlighting
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = "";
        textLayerRef.current.style.width = `${viewport.width}px`;
        textLayerRef.current.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();

        textContent.items.forEach((item) => {
          if ("str" in item && item.str) {
            const div = document.createElement("div");
            div.textContent = item.str;

            // Position the text
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            div.style.position = "absolute";
            div.style.left = `${tx[4]}px`;
            div.style.top = `${viewport.height - tx[5] - item.height * scale}px`;
            div.style.fontSize = `${item.height * scale}px`;
            div.style.fontFamily = "sans-serif";
            div.style.color = "transparent";
            div.style.whiteSpace = "nowrap";

            // Content-based highlighting: match if PDF text appears in highlight text
            // Use >= 4 to avoid matching short numbers like "75", "30" that appear everywhere
            // This still catches steel grades (S31266, TP304), table headers, etc.
            const itemText = item.str.toLowerCase().trim();
            const normalizedHighlight = highlightText?.toLowerCase() || "";
            const shouldHighlight = normalizedHighlight.length > 0 &&
              itemText.length >= 4 &&
              normalizedHighlight.includes(itemText);

            if (shouldHighlight) {
              div.style.backgroundColor = "rgba(255, 255, 0, 0.5)";
              div.style.color = "transparent";
              div.style.borderRadius = "2px";
              div.style.padding = "0 2px";
            }

            textLayerRef.current?.appendChild(div);
          }
        });
      }
    } catch (err) {
      console.error("Error rendering page:", err);
    }
  }, [pdfDoc, currentPage, scale, highlightText]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Navigation handlers
  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-slate-50">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-slate-800 truncate max-w-[200px]">
                  {documentName || "PDF Document"}
                </h2>
                {totalPages > 0 && (
                  <span className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-center gap-2 p-2 border-b bg-slate-50/50">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm text-slate-600">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-slate-200 mx-2" />
              <Button variant="outline" size="sm" onClick={zoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="px-2 text-sm text-slate-600 min-w-[50px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button variant="outline" size="sm" onClick={zoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-auto bg-slate-100 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full text-red-500">
                  {error}
                </div>
              ) : (
                <div className="relative inline-block mx-auto shadow-lg">
                  <canvas ref={canvasRef} className="block" />
                  <div
                    ref={textLayerRef}
                    className="absolute top-0 left-0 overflow-hidden pointer-events-none"
                    style={{ mixBlendMode: "multiply" }}
                  />
                </div>
              )}
            </div>

            {/* Highlight indicator */}
            {highlightText && (
              <div className="p-3 border-t bg-yellow-50 text-sm text-yellow-800">
                <span className="font-medium">Highlighting:</span> &quot;{highlightText.slice(0, 50)}
                {highlightText.length > 50 ? "..." : ""}&quot;
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
