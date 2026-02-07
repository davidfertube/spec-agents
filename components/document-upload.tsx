"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, FileText, X, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Maximum file size (50MB) - must match server-side limit
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface UploadedFile {
  name: string;
  size: number;
  status: "uploading" | "processing" | "complete" | "error";
  error?: string;
}

interface DocumentUploadProps {
  onUploadComplete?: (documentId: number | null) => void;
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentDocumentId, setCurrentDocumentId] = useState<number | null>(null);

  // Notify parent when file completes upload
  useEffect(() => {
    onUploadComplete?.(file?.status === "complete" ? currentDocumentId : null);
  }, [file, currentDocumentId, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );

    if (droppedFiles.length > 0) {
      handleFile(droppedFiles[0]); // Only take first file
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]); // Only take first file
    }
  };

  const handleFile = async (newFile: File) => {
    // Client-side file size validation for instant feedback
    if (newFile.size > MAX_FILE_SIZE) {
      setFile({
        name: newFile.name,
        size: newFile.size,
        status: "error",
        error: "File too large. Maximum size is 50MB.",
      });
      return;
    }

    const uploadFile: UploadedFile = {
      name: newFile.name,
      size: newFile.size,
      status: "uploading",
    };

    // Replace any existing file
    setFile(uploadFile);
    setUploadProgress(0);

    try {
      // ========================================
      // Step 1: Request Signed Upload URL
      // ========================================
      const urlResponse = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: newFile.name,
          fileSize: newFile.size,
          contentType: newFile.type,
        }),
      });

      if (!urlResponse.ok) {
        const errorData = await urlResponse.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || "Failed to get upload URL");
      }

      const { documentId, uploadUrl, path } = await urlResponse.json();
      setCurrentDocumentId(documentId);

      // ========================================
      // Step 2: Upload Directly to Supabase Storage
      // ========================================
      // Use XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percentComplete);
          }
        });

        // Handle completion
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        // Handle errors
        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload cancelled"));
        });

        // Start upload
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", "application/pdf");
        xhr.setRequestHeader("x-upsert", "false");
        xhr.send(newFile);
      });

      // ========================================
      // Step 3: Confirm Upload Completion
      // ========================================
      const confirmResponse = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, path }),
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || "Upload confirmation failed");
      }

      // Update status to processing
      setFile((prev) =>
        prev ? { ...prev, status: "processing" } : null
      );

      // ========================================
      // Step 4: Process Document (Extract Text & Generate Embeddings)
      // ========================================
      const processResponse = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || errorData.details;

        // Provide context-specific fallback based on status code
        const fallbackMessage = processResponse.status === 429
          ? "Service is busy. Please wait a moment and try again."
          : processResponse.status >= 500
          ? "Server error occurred. Please try again later."
          : "Processing failed. Please try again.";

        throw new Error(errorMessage || fallbackMessage);
      }

      // Update status to complete
      setFile((prev) =>
        prev ? { ...prev, status: "complete" } : null
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      setFile((prev) =>
        prev ? { ...prev, status: "error", error: errorMessage } : null
      );
      setUploadProgress(0);
      setCurrentDocumentId(null);
    }
  };

  const removeFile = () => {
    setFile(null);
    setCurrentDocumentId(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Estimate page count from file size (rough: ~50KB per page average for ASTM specs)
  const estimatePageCount = (bytes: number) => {
    return Math.max(1, Math.round(bytes / (50 * 1024)));
  };

  // Estimate processing time: ~3 seconds per page
  // Formula: pages × 3s (includes upload, extraction, chunking, embedding)
  const estimateProcessingTime = (bytes: number) => {
    const pages = estimatePageCount(bytes);
    const seconds = Math.max(10, pages * 3); // Minimum 10 seconds
    if (seconds < 60) return `~${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes} min`;
  };

  return (
    <Card className="border border-black/10 dark:border-white/10">
      <CardContent className="p-6">
        {/* Show upload area only if no file or file has error */}
        {(!file || file.status === "error") && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors
              ${isDragging ? "border-black dark:border-white bg-black/5 dark:bg-white/5" : "border-black/20 dark:border-white/20 hover:border-black/40 dark:hover:border-white/40"}
            `}
          >
            <Upload className="w-12 h-12 sm:w-10 sm:h-10 mx-auto mb-4 text-black/40 dark:text-white/40" />
            <p className="text-base sm:text-lg font-medium text-black dark:text-white mb-2">
              Drop your PDF here
            </p>
            <p className="text-sm sm:text-base text-black/60 dark:text-white/60 mb-2">
              or click to browse your files
            </p>
            <p className="text-xs sm:text-sm text-black/40 dark:text-white/40 mb-4">
              Up to 50MB • 500+ pages supported
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <Button variant="outline" size="lg" className="touch-target" asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                Select File
              </label>
            </Button>
          </div>
        )}

        {/* Show file status */}
        {file && (
          <div className={`space-y-3 ${file.status === "error" ? "mt-4" : ""}`}>
            <div
              className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg transition-all ${
                file.status === "complete"
                  ? "bg-green-50 dark:bg-green-950/30 border-2 border-green-500"
                  : file.status === "error"
                  ? "bg-red-50 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-800"
                  : "bg-black/5 dark:bg-white/5 border-2 border-black/10 dark:border-white/10"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0 w-full sm:w-auto">
                <FileText className={`w-6 h-6 flex-shrink-0 ${
                  file.status === "complete" ? "text-green-600 dark:text-green-400" : "text-black/60 dark:text-white/60"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-medium text-black dark:text-white truncate">
                    {file.name}
                  </p>
                  <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={removeFile}
                  className="p-2 touch-target hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors sm:hidden"
                  title="Remove file"
                >
                  <X className="w-5 h-5 text-black/60 dark:text-white/60" />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                {file.status === "uploading" && (
                  <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span className="text-sm sm:text-base font-medium text-blue-600">
                        Uploading... {uploadProgress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                {file.status === "processing" && (
                  <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                      <span className="text-sm sm:text-base font-medium text-amber-600">
                        Processing...
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-600 h-2 rounded-full animate-pulse"
                        style={{ width: "60%" }}
                      />
                    </div>
                    <span className="text-xs text-amber-600/70">
                      ~{estimatePageCount(file.size)} pages • {estimateProcessingTime(file.size)} estimated
                    </span>
                  </div>
                )}
                {file.status === "complete" && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm sm:text-base font-medium text-green-600">Ready!</span>
                  </div>
                )}
                {file.status === "error" && (
                  <span className="text-sm sm:text-base text-red-600 break-words">{file.error}</span>
                )}
                <button
                  onClick={removeFile}
                  className="hidden sm:block p-2 touch-target hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                  title="Remove file"
                >
                  <X className="w-4 h-4 text-black/60 dark:text-white/60" />
                </button>
              </div>
            </div>

            {/* Replace file option when complete */}
            {file.status === "complete" && (
              <div className="text-center">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-replace"
                />
                <label
                  htmlFor="file-replace"
                  className="text-sm text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white cursor-pointer transition-colors"
                >
                  Upload a different document
                </label>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
