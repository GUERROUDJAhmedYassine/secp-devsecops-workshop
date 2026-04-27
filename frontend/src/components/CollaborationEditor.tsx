import { useRef, useCallback } from 'react';
import { X, Users, FileText, Table as TableIcon } from 'lucide-react';
import { useCollaboration } from '../hooks/useCollaboration';
import type { CollaborationSessionResponse } from '../types/files.types';
import TipTapEditor from './TipTapEditor';
import type { TipTapEditorRef } from './TipTapEditor';
import HtmlDocumentEditor from './HtmlDocumentEditor';
import type { HtmlDocumentEditorRef } from './HtmlDocumentEditor';

interface CollaborationEditorProps {
  sessionInfo: CollaborationSessionResponse;
  filename: string;
  onClose: () => void;
}

const EXCEL_COLS = ['A', 'B', 'C', 'D', 'E'];
const EXCEL_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function CollaborationEditor({ sessionInfo, filename, onClose }: CollaborationEditorProps) {
  const editorRef = useRef<TipTapEditorRef>(null);
  const htmlEditorRef = useRef<HtmlDocumentEditorRef>(null);

  const handleRemoteYjsUpdate = useCallback((updateBase64: string) => {
    editorRef.current?.applyRemoteUpdate(updateBase64);
  }, []);

  const { state, error, updateText, updateCell, sendYjsUpdate, sendSyncContent } = useCollaboration(
    sessionInfo,
    handleRemoteYjsUpdate
  );

  const usesStructuredHtmlEditor = state?.mode === 'word' && filename.toLowerCase().endsWith('.docx');

  const handleStructuredDocumentChange = useCallback((html: string) => {
    updateText(html);
    sendSyncContent(html);
  }, [sendSyncContent, updateText]);

  // For Excel mode
  const handleCellChange = (cell: string, value: string) => {
    updateCell(cell, value);
  };

  const handleClose = () => {
    editorRef.current?.flushSync();
    htmlEditorRef.current?.flushSync();
    onClose();
  };

  if (!state) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-card border border-border p-8 rounded-xl flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-[#4f8ef7] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-primary font-medium">Connecting to Collaboration Session...</p>
          {error && <p className="text-[#ef4444] mt-2 text-sm">{error}</p>}
          <button onClick={handleClose} className="mt-6 px-4 py-2 bg-page border border-border rounded text-muted hover:text-primary transition-colors">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-page transition-colors duration-200">
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-border bg-card px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-page rounded-lg border border-border">
            {state.mode === 'word' ? <FileText className="w-5 h-5 text-[#3b82f6]" /> : <TableIcon className="w-5 h-5 text-[#22c55e]" />}
          </div>
          <div>
            <h2 className="text-primary font-semibold text-lg leading-tight">{filename}</h2>
            <p className="text-muted text-xs font-medium uppercase tracking-wider">
              {state.mode.toUpperCase()} MODE • REV {state.revision}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-page border border-border rounded-lg">
            <Users className="w-4 h-4 text-muted" />
            <span className="text-sm font-medium text-primary">{state.participants.length} Active</span>
          </div>
          <div className="flex -space-x-2 mr-2">
            {state.participants.map((p, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-card bg-gradient-to-br from-[#4f8ef7] to-[#81abea] flex items-center justify-center text-white text-xs font-bold" title={p}>
                {p.substring(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
          <div className="w-px h-8 bg-border" />
          <button onClick={handleClose} className="p-2 text-muted hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Editor Body */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {error && (
          <div className="absolute top-0 left-0 w-full bg-[#ef4444] text-white text-sm font-medium text-center py-1 z-10">
            {error}
          </div>
        )}

        {state.mode === 'word' && (
          <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 h-full flex flex-col">
            {usesStructuredHtmlEditor ? (
              <HtmlDocumentEditor
                ref={htmlEditorRef}
                value={state.text_content}
                onChange={handleStructuredDocumentChange}
              />
            ) : (
              <TipTapEditor
                ref={editorRef}
                initialText={state.text_content}
                yjsUpdates={state.yjs_updates}
                onLocalUpdate={sendYjsUpdate}
                onSync={sendSyncContent}
              />
            )}
          </div>
        )}

        {state.mode === 'excel' && (
          <div className="flex-1 overflow-auto p-8">
            <div className="inline-block bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <table className="border-collapse">
                <thead>
                  <tr>
                    <th className="bg-page border-b border-r border-border p-2 min-w-[50px]"></th>
                    {EXCEL_COLS.map(col => (
                      <th key={col} className="bg-page border-b border-r border-border p-2 min-w-[120px] text-xs font-bold text-muted text-center">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {EXCEL_ROWS.map(row => (
                    <tr key={row}>
                      <td className="bg-page border-b border-r border-border p-2 text-xs font-bold text-muted text-center bg-opacity-50">
                        {row}
                      </td>
                      {EXCEL_COLS.map(col => {
                        const cellId = `${col}${row}`;
                        return (
                          <td key={col} className="border-b border-r border-border p-0 relative">
                            <input
                              type="text"
                              value={state.sheet_cells[cellId] || ''}
                              onChange={(e) => handleCellChange(cellId, e.target.value)}
                              className="w-full h-full p-2 bg-transparent text-sm text-primary focus:outline-none focus:bg-page focus:ring-1 focus:ring-inset focus:ring-[#4f8ef7]"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
