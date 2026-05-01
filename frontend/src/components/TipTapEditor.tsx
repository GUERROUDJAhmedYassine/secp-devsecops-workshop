import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as Y from 'yjs';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import * as base64 from 'base64-js';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Redo2, Undo2 } from 'lucide-react';

export interface TipTapEditorRef {
  applyRemoteUpdate: (updateBase64: string) => void;
  flushSync: () => void;
}

interface TipTapEditorProps {
  onLocalUpdate: (updateBase64: string) => void;
  onSync: (content: string) => void;
  initialText: string;
  yjsUpdates?: string[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToEditorHtml(text: string): string {
  if (!text.trim()) return '<p></p>';

  const normalized = text.replace(/\r\n/g, '\n');
  const decoded = decodeHtmlEntities(normalized);
  const candidate = looksLikeHtml(decoded) ? decoded : normalized;

  if (looksLikeHtml(candidate)) {
    const repaired = candidate.replace(/^([^<]+)<\/p>/i, '<p>$1</p>');
    const template = document.createElement('template');
    template.innerHTML = repaired;
    const hasParsedElements = Array.from(template.content.childNodes).some(
      (node) => node.nodeType === Node.ELEMENT_NODE,
    );

    if (hasParsedElements) {
      return trimEmptyLeadingParagraphs(template.innerHTML);
    }
  }

  return candidate
    .split('\n')
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : '<p></p>'))
    .join('');
}

function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

function trimEmptyLeadingParagraphs(html: string): string {
  const trimmed = html.replace(
    /^(?:\s*<p>(?:&nbsp;|\u00a0|\s|<br\s*\/?>)*<\/p>)+/i,
    '',
  );
  return trimmed.trim() ? trimmed : '<p></p>';
}

const TipTapEditor = forwardRef<TipTapEditorRef, TipTapEditorProps>(
  ({ onLocalUpdate, onSync, initialText, yjsUpdates }, ref) => {
    const [ydoc] = useState(() => new Y.Doc());
    const isBootstrappingRef = useRef(false);
    const didInitializeRef = useRef(false);
    const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({ history: false } as any),
        Collaboration.configure({
          document: ydoc,
        }),
      ],
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none dark:prose-invert min-h-full w-full',
        },
      },
      onUpdate: ({ editor: activeEditor }) => {
        if (isBootstrappingRef.current) return;
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          onSync(activeEditor.getHTML());
        }, 2000);
      },
    });

    useEffect(() => {
      if (!editor || didInitializeRef.current) return;

      didInitializeRef.current = true;
      isBootstrappingRef.current = true;

      try {
        if (initialText) {
          editor.commands.setContent(textToEditorHtml(initialText), false);
        }

        const shouldReplayHistoricalUpdates = !initialText.trim();
        for (const updateBase64 of shouldReplayHistoricalUpdates ? yjsUpdates ?? [] : []) {
          try {
            const update = base64.toByteArray(updateBase64);
            Y.applyUpdate(ydoc, update, 'remote');
          } catch (error) {
            console.error('Failed to apply historical update', error);
          }
        }
      } finally {
        queueMicrotask(() => {
          isBootstrappingRef.current = false;
        });
      }
    }, [editor, initialText, ydoc, yjsUpdates]);

    useImperativeHandle(
      ref,
      () => ({
        applyRemoteUpdate: (updateBase64: string) => {
          try {
            const update = base64.toByteArray(updateBase64);
            Y.applyUpdate(ydoc, update, 'remote');
          } catch (error) {
            console.error('Failed to apply remote yjs update', error);
          }
        },
        flushSync: () => {
          if (!editor) return;
          if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
          }
          onSync(editor.getHTML());
        },
      }),
      [editor, onSync, ydoc],
    );

    useEffect(() => {
      const handleUpdate = (update: Uint8Array, origin: unknown) => {
        if (origin === 'remote' || isBootstrappingRef.current) return;
        const updateBase64 = base64.fromByteArray(update);
        onLocalUpdate(updateBase64);
      };

      ydoc.on('update', handleUpdate);
      return () => {
        ydoc.off('update', handleUpdate);
      };
    }, [onLocalUpdate, ydoc]);

    useEffect(() => {
      return () => {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
      };
    }, []);

    if (!editor) return null;

    return (
      <div className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-page">
          <button onClick={() => editor.chain().focus().undo().run()} className="p-2 rounded text-muted transition-colors hover:text-primary hover:bg-border" title="Undo"><Undo2 className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().redo().run()} className="p-2 rounded text-muted transition-colors hover:text-primary hover:bg-border" title="Redo"><Redo2 className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-border mx-2" />
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded transition-colors ${editor.isActive('bold') ? 'bg-border text-primary' : 'text-muted hover:text-primary hover:bg-border'}`}><Bold className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded transition-colors ${editor.isActive('italic') ? 'bg-border text-primary' : 'text-muted hover:text-primary hover:bg-border'}`}><Italic className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-border mx-2" />
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-2 rounded transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-border text-primary' : 'text-muted hover:text-primary hover:bg-border'}`}><Heading1 className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-2 rounded transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-border text-primary' : 'text-muted hover:text-primary hover:bg-border'}`}><Heading2 className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-border mx-2" />
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-2 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-border text-primary' : 'text-muted hover:text-primary hover:bg-border'}`}><List className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-2 rounded transition-colors ${editor.isActive('orderedList') ? 'bg-border text-primary' : 'text-muted hover:text-primary hover:bg-border'}`}><ListOrdered className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 cursor-text" onClick={() => editor.commands.focus()}>
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    );
  },
);

TipTapEditor.displayName = 'TipTapEditor';
export default TipTapEditor;
