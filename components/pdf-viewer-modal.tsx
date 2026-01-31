"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight, Download, Loader2, ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Source } from "@/lib/api";
import * as pdfjsLib from "pdfjs-dist";

// Configure pdf.js worker - use unpkg which serves all npm package versions
// Note: cdnjs only has up to v5.4.149, but pdfjs-dist is v5.4.530
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface PDFViewerModalProps {
  source: Source | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PDFViewerModal({ source, isOpen, onClose }: PDFViewerModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);

  // Build the PDF URL - prefer proxy endpoint for better reliability (avoids CORS/expiry)
  const pdfUrl = (() => {
    // Prefer proxy endpoint (avoids CORS, has caching, no URL expiry)
    if (source?.storage_path) {
      return `/api/documents/pdf?path=${encodeURIComponent(source.storage_path)}`;
    }
    // Fallback to signed URL
    if (source?.document_url) {
      return source.document_url.split("#")[0];
    }
    return null;
  })();

  // Track source page to detect changes
  const sourcePage = source?.page;

  // Load PDF document when source changes
  useEffect(() => {
    if (!isOpen || !pdfUrl) return;

    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const doc = await loadingTask.promise;

        if (cancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);

        // Navigate to cited page
        const targetPage = parseInt(sourcePage || "1") || 1;
        setCurrentPage(Math.min(Math.max(1, targetPage), doc.numPages));
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load PDF:", err);
        setError("Failed to load PDF document. Please try again.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [isOpen, pdfUrl, sourcePage]);

  // Render page with text layer and yellow highlighting
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current || loading) return;

    let cancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });

        // Render to canvas
        const canvas = canvasRef.current!;
        const context = canvas.getContext("2d")!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (page.render as any)({
          canvasContext: context,
          viewport,
        }).promise;

        if (cancelled) return;

        // Render text layer with yellow highlighting
        const textContent = await page.getTextContent();
        if (cancelled) return;

        const textLayer = textLayerRef.current!;
        textLayer.innerHTML = "";
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;

        // Get char offset range for highlighting
        const charStart = source?.char_offset_start ?? -1;
        const charEnd = source?.char_offset_end ?? (charStart >= 0 ? charStart + 200 : -1);
        const targetPage = parseInt(source?.page || "0");
        const isTargetPage = currentPage === targetPage;

        let charPosition = 0;
        let firstHighlightElement: HTMLDivElement | null = null;

        textContent.items.forEach((item) => {
          if (!("str" in item) || !item.str) return;

          const div = document.createElement("div");
          div.textContent = item.str;

          // Position text using PDF.js transform
          const tx = pdfjsLib.Util.transform(
            viewport.transform,
            item.transform
          );

          div.style.position = "absolute";
          div.style.left = `${tx[4]}px`;
          div.style.top = `${viewport.height - tx[5]}px`;
          div.style.fontSize = `${Math.abs(tx[0])}px`;
          div.style.fontFamily = "sans-serif";
          div.style.color = "transparent";
          div.style.whiteSpace = "pre";
          div.style.transformOrigin = "0% 0%";

          // Track character position for highlighting
          const itemStart = charPosition;
          const itemEnd = charPosition + item.str.length;
          charPosition = itemEnd;

          // Apply yellow highlight if within char offset range on target page
          if (isTargetPage && charStart >= 0 && itemEnd > charStart && itemStart < charEnd) {
            div.style.backgroundColor = "rgba(255, 255, 0, 0.5)";
            div.style.borderRadius = "2px";
            div.style.padding = "0 1px";
            div.dataset.highlighted = "true";

            if (!firstHighlightElement) {
              firstHighlightElement = div;
            }
          }

          textLayer.appendChild(div);
        });

        // Scroll to first highlighted element after a brief delay
        if (firstHighlightElement && containerRef.current) {
          setTimeout(() => {
            if (firstHighlightElement && !cancelled) {
              firstHighlightElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }
          }, 100);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to render page:", err);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, scale, source, loading]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          setCurrentPage((prev) => Math.max(1, prev - 1));
          break;
        case "ArrowRight":
          setCurrentPage((prev) => Math.min(totalPages, prev + 1));
          break;
        case "Escape":
          onClose();
          break;
        case "+":
        case "=":
          setScale((s) => Math.min(3, s + 0.2));
          break;
        case "-":
          setScale((s) => Math.max(0.5, s - 0.2));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, totalPages]);

  const handleDownload = useCallback(() => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  }, [pdfUrl]);

  const handleOpenExternal = useCallback(() => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  }, [pdfUrl]);

  if (!source) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-4 md:inset-8 z-50 flex flex-col bg-background rounded-lg shadow-2xl border border-border overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-3">
              <div>
                <Dialog.Title className="font-semibold text-sm">
                  {source.document}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground">
                  Citation {source.ref} - Page {currentPage} of {totalPages || "?"}
                </Dialog.Description>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 px-2 border-r border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
                  className="h-8 w-8 p-0"
                  title="Zoom out (-)"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-12 text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setScale((s) => Math.min(3, s + 0.2))}
                  className="h-8 w-8 p-0"
                  title="Zoom in (+)"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              {/* Page Navigation */}
              <div className="flex items-center gap-1 px-2 border-r border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="h-8 w-8 p-0"
                  title="Previous page (←)"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-16 text-center">
                  {currentPage} / {totalPages || "?"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-8 w-8 p-0"
                  title="Next page (→)"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Open External */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenExternal}
                className="h-8 w-8 p-0"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>

              {/* Download */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 w-8 p-0"
                title="Download PDF"
              >
                <Download className="h-4 w-4" />
              </Button>

              {/* Close */}
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="Close (Esc)"
                >
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
          </div>

          {/* PDF Viewer */}
          <div ref={containerRef} className="flex-1 relative bg-muted/30 overflow-auto">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span>Loading PDF...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <div className="flex flex-col items-center gap-3 text-center p-8">
                  <p className="text-red-500">{error}</p>
                  <Button onClick={handleOpenExternal} variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Browser
                  </Button>
                </div>
              </div>
            )}

            {!loading && !error && pdfDoc && (
              <div className="flex justify-center p-4">
                <div className="relative shadow-lg bg-white">
                  <canvas ref={canvasRef} />
                  <div
                    ref={textLayerRef}
                    className="absolute top-0 left-0 overflow-hidden"
                    style={{ pointerEvents: "none" }}
                  />
                </div>
              </div>
            )}

            {!loading && !error && !pdfDoc && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                <p className="text-muted-foreground">PDF URL not available</p>
                <Button onClick={handleOpenExternal} disabled={!source.document_url}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Original URL
                </Button>
              </div>
            )}
          </div>

          {/* Footer with content preview */}
          <div className="px-4 py-3 border-t border-border bg-muted/50">
            <div className="flex items-start gap-3">
              <div className="w-1 h-full min-h-[40px] bg-yellow-500 rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Highlighted text on page {parseInt(source.page) || 1}:
                </p>
                <p className="text-sm text-foreground leading-relaxed line-clamp-3 font-medium">
                  &quot;{source.content_preview}&quot;
                </p>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
