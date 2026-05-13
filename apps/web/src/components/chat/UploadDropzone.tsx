"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, FileText, Loader2, Upload, XCircle } from "lucide-react";
import { useCallback, useState } from "react";

interface UploadedFile {
  attachmentId: number;
  filename: string;
  status: "uploading" | "done" | "error";
  error?: string;
}

interface UploadDropzoneProps {
  sessionId: string;
  onUploaded: (attachmentId: number) => void;
}

export function UploadDropzone({ sessionId, onUploaded }: UploadDropzoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const tempId = Date.now();

      setFiles((prev) => [
        ...prev,
        { attachmentId: tempId, filename: file.name, status: "uploading" },
      ]);

      const form = new FormData();
      form.append("session_id", sessionId);
      form.append("file", file);

      try {
        const res = await fetch(`${apiUrl}/upload`, { method: "POST", body: form });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setFiles((prev) =>
          prev.map((f) =>
            f.attachmentId === tempId ? { ...f, attachmentId: data.attachment_id, status: "done" } : f
          )
        );
        onUploaded(data.attachment_id);
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.attachmentId === tempId ? { ...f, status: "error", error: String(err) } : f
          )
        );
      }
    },
    [sessionId, onUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      Array.from(e.dataTransfer.files).forEach(uploadFile);
    },
    [uploadFile]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      Array.from(e.target.files ?? []).forEach(uploadFile);
      e.target.value = "";
    },
    [uploadFile]
  );

  return (
    <div className="flex flex-col gap-2">
      <label
        className={cn(
          "flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
          isDragging
            ? "border-indigo-400 bg-indigo-500/10"
            : "border-white/20 hover:border-white/40 hover:bg-white/5"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Upload size={20} className="text-white/50" />
        <span className="text-xs text-white/50">
          Arrastra tu documento aquí o{" "}
          <span className="text-indigo-400 underline">selecciona un archivo</span>
        </span>
        <span className="text-xs text-white/30">JPG, PNG, PDF · Máx. 10 MB</span>
        <input type="file" accept=".jpg,.jpeg,.png,.pdf,.webp" className="hidden" multiple onChange={handleInput} />
      </label>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f) => (
            <li key={f.attachmentId} className="flex items-center gap-2 text-xs text-white/70 bg-white/5 rounded-lg px-3 py-2">
              <FileText size={14} className="flex-shrink-0" />
              <span className="flex-1 truncate">{f.filename}</span>
              {f.status === "uploading" && <Loader2 size={14} className="animate-spin text-indigo-400" />}
              {f.status === "done" && <CheckCircle2 size={14} className="text-green-400" />}
              {f.status === "error" && (
                <span title={f.error}><XCircle size={14} className="text-red-400" /></span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
