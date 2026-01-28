"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, FileText, X, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface UploadedFile {
  name: string;
  size: number;
  status: "uploading" | "processing" | "complete" | "error";
  error?: string;
}

interface DocumentUploadProps {
  onUploadComplete?: (hasCompleted: boolean) => void;
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Notify parent when file completes upload
  useEffect(() => {
    onUploadComplete?.(file?.status === "complete" || false);
  }, [file, onUploadComplete]);

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
    const uploadFile: UploadedFile = {
      name: newFile.name,
      size: newFile.size,
      status: "uploading",
    };

    // Replace any existing file
    setFile(uploadFile);

    try {
      // Upload to API
      const formData = new FormData();
      formData.append("file", newFile);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || "Upload failed");
      }

      const uploadResult = await response.json();

      // Update status to processing
      setFile((prev) =>
        prev ? { ...prev, status: "processing" } : null
      );

      // Call process endpoint to extract text and generate embeddings
      const processResponse = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: uploadResult.documentId }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || "Processing failed");
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
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <Card className="border border-black/10">
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
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragging ? "border-black bg-black/5" : "border-black/20 hover:border-black/40"}
            `}
          >
            <Upload className="w-10 h-10 mx-auto mb-4 text-black/40" />
            <p className="text-lg font-medium text-black mb-2">
              Drop your PDF here
            </p>
            <p className="text-sm text-black/60 mb-4">
              or click to browse your files
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <Button variant="outline" asChild>
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
              className={`flex items-center gap-3 p-4 rounded-lg transition-all ${
                file.status === "complete"
                  ? "bg-green-50 border-2 border-green-500"
                  : file.status === "error"
                  ? "bg-red-50 border-2 border-red-300"
                  : "bg-black/5 border-2 border-black/10"
              }`}
            >
              <FileText className={`w-6 h-6 flex-shrink-0 ${
                file.status === "complete" ? "text-green-600" : "text-black/60"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black truncate">
                  {file.name}
                </p>
                <p className="text-xs text-black/60">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {file.status === "uploading" && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-black/60" />
                    <span className="text-sm text-black/60">Uploading...</span>
                  </div>
                )}
                {file.status === "processing" && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                    <span className="text-sm font-medium text-amber-600">Processing...</span>
                  </div>
                )}
                {file.status === "complete" && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">Ready!</span>
                  </div>
                )}
                {file.status === "error" && (
                  <span className="text-sm text-red-600">{file.error}</span>
                )}
                <button
                  onClick={removeFile}
                  className="p-1.5 hover:bg-black/10 rounded-full transition-colors"
                  title="Remove file"
                >
                  <X className="w-4 h-4 text-black/60" />
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
                  className="text-sm text-black/50 hover:text-black cursor-pointer transition-colors"
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
