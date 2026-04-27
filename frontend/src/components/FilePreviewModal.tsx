import { useEffect, useMemo, useState } from 'react';
import { X, LoaderCircle, FileText, Image as ImageIcon, FileSearch } from 'lucide-react';
import { getFileBlob, getFilePreview } from '../api/files';
import { getPreviewKind } from '../types/files.types';
import type { FilePreviewResponse, SecureFile } from '../types/files.types';

interface FilePreviewModalProps {
  file: SecureFile;
  onClose: () => void;
}

interface BinaryPreviewState {
  kind: 'image' | 'pdf';
  url: string;
}

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FilePreviewResponse | null>(null);
  const [binaryPreview, setBinaryPreview] = useState<BinaryPreviewState | null>(null);

  const previewKind = useMemo(
    () => getPreviewKind(file.mime_type, file.filename),
    [file.filename, file.mime_type],
  );

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(null);
    setPreview(null);
    setBinaryPreview(null);

    const loadPreview = async () => {
      try {
        if (previewKind === 'image' || previewKind === 'pdf') {
          const blob = await getFileBlob(file.id);
          objectUrl = URL.createObjectURL(blob);
          if (!active) return;
          setBinaryPreview({ kind: previewKind, url: objectUrl });
        } else {
          const response = await getFilePreview(file.id);
          if (!active) return;
          setPreview(response);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Preview failed');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file.id, previewKind]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[90vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border bg-page">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-primary truncate">{file.filename}</h2>
            <p className="text-xs text-muted uppercase tracking-wider">Preview</p>
          </div>
          <button onClick={onClose} className="p-2 text-muted hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 min-h-0 bg-page">
          {loading && (
            <div className="h-full flex flex-col items-center justify-center text-muted gap-3">
              <LoaderCircle className="w-8 h-8 animate-spin" />
              <p>Loading preview...</p>
            </div>
          )}

          {!loading && error && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3">
              <FileSearch className="w-9 h-9 text-[#ef4444]" />
              <p className="text-primary font-medium">Preview unavailable</p>
              <p className="text-sm text-muted max-w-xl">{error}</p>
            </div>
          )}

          {!loading && !error && binaryPreview?.kind === 'image' && (
            <div className="h-full flex items-center justify-center p-6 overflow-auto">
              <img src={binaryPreview.url} alt={file.filename} className="max-w-full max-h-full rounded-xl shadow-lg border border-border bg-card object-contain" />
            </div>
          )}

          {!loading && !error && binaryPreview?.kind === 'pdf' && (
            <iframe
              src={binaryPreview.url}
              title={file.filename}
              className="w-full h-full border-0 bg-white"
            />
          )}

          {!loading && !error && preview?.kind === 'html' && (
            <div className="h-full overflow-auto p-6">
              <div className="mx-auto max-w-4xl bg-card border border-border rounded-xl p-6 shadow-sm">
                <div
                  className="prose prose-sm sm:prose lg:prose-lg max-w-none dark:prose-invert [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:align-top [&_td]:p-3 [&_th]:border [&_th]:border-border [&_th]:bg-page [&_th]:p-3 [&_th]:text-left"
                  dangerouslySetInnerHTML={{ __html: preview.content }}
                />
              </div>
            </div>
          )}

          {!loading && !error && preview?.kind === 'text' && (
            <div className="h-full overflow-auto p-6">
              <div className="mx-auto max-w-4xl bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 text-muted mb-4">
                  <FileText className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Read-only text preview</span>
                </div>
                <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-primary font-mono">
                  {preview.content}
                </pre>
              </div>
            </div>
          )}

          {!loading && !error && !binaryPreview && !preview && (
            <div className="h-full flex flex-col items-center justify-center text-muted gap-3">
              <ImageIcon className="w-9 h-9" />
              <p>No preview available.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
