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
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Notify parent when any file completes upload
  useEffect(() => {
    const hasCompleted = files.some((f) => f.status === "complete");
    onUploadComplete?.(hasCompleted);
  }, [files, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === "application/pdf"
    );

    handleFiles(droppedFiles);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  };

  const handleFiles = async (newFiles: File[]) => {
    for (const file of newFiles) {
      const uploadFile: UploadedFile = {
        name: file.name,
        size: file.size,
        status: "uploading",
      };

      setFiles((prev) => [...prev, uploadFile]);

      try {
        // Upload to API
        const formData = new FormData();
        formData.append("file", file);

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
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, status: "processing" } : f
          )
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
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, status: "complete" } : f
          )
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Upload failed";
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name
              ? { ...f, status: "error", error: errorMessage }
              : f
          )
        );
      }
    }
  };

  const removeFile = (fileName: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <Card className="border border-black/10">
      <CardContent className="p-6">
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
            Drop PDF files here
          </p>
          <p className="text-sm text-black/60 mb-4">
            or click to browse your files
          </p>
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
          />
          <Button variant="outline" asChild>
            <label htmlFor="file-upload" className="cursor-pointer">
              Select Files
            </label>
          </Button>
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium text-black">Uploaded Documents</p>
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-3 p-3 bg-black/5 rounded-lg"
              >
                <FileText className="w-5 h-5 text-black/60 flex-shrink-0" />
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
                    <Loader2 className="w-4 h-4 animate-spin text-black/60" />
                  )}
                  {file.status === "processing" && (
                    <span className="text-xs text-amber-600">Processing...</span>
                  )}
                  {file.status === "complete" && (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                  {file.status === "error" && (
                    <span className="text-xs text-red-600">{file.error}</span>
                  )}
                  <button
                    onClick={() => removeFile(file.name)}
                    className="p-1 hover:bg-black/10 rounded"
                  >
                    <X className="w-4 h-4 text-black/60" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
