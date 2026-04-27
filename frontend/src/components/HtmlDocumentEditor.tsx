import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Rows3,
  Strikethrough,
  Table,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';

export interface HtmlDocumentEditorRef {
  flushSync: () => void;
}

interface HtmlDocumentEditorProps {
  value: string;
  onChange: (html: string) => void;
}

type TablePosition = 'above' | 'below' | 'left' | 'right';

interface TableContext {
  table: HTMLTableElement;
  row: HTMLTableRowElement;
  cell: HTMLTableCellElement;
  rowIndex: number;
  cellIndex: number;
}

function normalizeHtml(html: string): string {
  const trimmed = html.trim();
  return trimmed ? trimmed : '<p></p>';
}

function findClosestElement(node: Node | null, tagNames: string[], boundary: HTMLElement | null): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement && tagNames.includes(current.tagName)) {
      return current;
    }
    if (boundary && current === boundary) {
      break;
    }
    current = current.parentNode;
  }
  return null;
}

function placeCaretAtStart(element: HTMLElement) {
  const target = element.querySelector('p, div') ?? element;
  const range = document.createRange();
  range.selectNodeContents(target);
  range.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function createEmptyCell(tagName: 'TD' | 'TH'): HTMLTableCellElement {
  const cell = document.createElement(tagName.toLowerCase()) as HTMLTableCellElement;
  const paragraph = document.createElement('p');
  paragraph.innerHTML = '<br>';
  cell.appendChild(paragraph);
  return cell;
}

const toolbarButtonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-page text-muted transition-colors hover:text-primary hover:border-[#4f8ef7]/40 hover:bg-card';

const toolbarWideButtonClass =
  'inline-flex h-9 items-center gap-2 rounded-md border border-border bg-page px-3 text-xs font-medium text-muted transition-colors hover:text-primary hover:border-[#4f8ef7]/40 hover:bg-card';

const HtmlDocumentEditor = forwardRef<HtmlDocumentEditorRef, HtmlDocumentEditorProps>(
  ({ value, onChange }, ref) => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const queueSync = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const nextHtml = normalizeHtml(editor.innerHTML);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onChange(nextHtml);
      }, 250);
    }, [onChange]);

    const flushSync = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      onChange(normalizeHtml(editor.innerHTML));
    }, [onChange]);

    const focusEditor = useCallback(() => {
      editorRef.current?.focus();
    }, []);

    const runCommand = useCallback((command: string, value?: string) => {
      focusEditor();
      document.execCommand(command, false, value);
      queueSync();
    }, [focusEditor, queueSync]);

    const setBlock = useCallback((tag: 'p' | 'h1' | 'h2' | 'h3') => {
      runCommand('formatBlock', tag);
    }, [runCommand]);

    const getTableContext = useCallback((): TableContext | null => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection?.anchorNode) return null;

      const cell = findClosestElement(selection.anchorNode, ['TD', 'TH'], editor) as HTMLTableCellElement | null;
      if (!cell) return null;

      const row = cell.closest('tr');
      const table = cell.closest('table');
      if (!(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement)) {
        return null;
      }

      return {
        table,
        row,
        cell,
        rowIndex: Array.from(table.rows).indexOf(row),
        cellIndex: Array.from(row.cells).indexOf(cell),
      };
    }, []);

    const insertTable = useCallback((rows = 3, cols = 3) => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection?.rangeCount) return;

      const range = selection.getRangeAt(0);
      const table = document.createElement('table');
      const tbody = document.createElement('tbody');

      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const row = document.createElement('tr');
        for (let colIndex = 0; colIndex < cols; colIndex += 1) {
          row.appendChild(createEmptyCell('TD'));
        }
        tbody.appendChild(row);
      }

      table.appendChild(tbody);
      range.deleteContents();
      range.insertNode(table);

      const trailingParagraph = document.createElement('p');
      trailingParagraph.innerHTML = '<br>';
      table.parentNode?.insertBefore(trailingParagraph, table.nextSibling);

      const firstCell = table.querySelector('td, th');
      if (firstCell instanceof HTMLElement) {
        placeCaretAtStart(firstCell);
      }

      queueSync();
    }, [queueSync]);

    const updateTable = useCallback((direction: TablePosition) => {
      const context = getTableContext();
      if (!context) return;

      if (direction === 'above' || direction === 'below') {
        const newRow = document.createElement('tr');
        Array.from(context.row.cells).forEach((existingCell) => {
          const tagName = existingCell.tagName === 'TH' ? 'TH' : 'TD';
          newRow.appendChild(createEmptyCell(tagName));
        });

        if (direction === 'above') {
          context.row.parentNode?.insertBefore(newRow, context.row);
        } else {
          context.row.parentNode?.insertBefore(newRow, context.row.nextSibling);
        }

        const targetCell = newRow.cells[Math.max(0, Math.min(context.cellIndex, newRow.cells.length - 1))];
        if (targetCell instanceof HTMLElement) {
          placeCaretAtStart(targetCell);
        }
      } else {
        Array.from(context.table.rows).forEach((row) => {
          const referenceCell = row.cells[Math.max(0, context.cellIndex)] ?? row.cells[row.cells.length - 1];
          const tagName = referenceCell?.tagName === 'TH' ? 'TH' : 'TD';
          const newCell = createEmptyCell(tagName);
          const insertIndex = direction === 'left' ? context.cellIndex : context.cellIndex + 1;
          row.insertBefore(newCell, row.cells[insertIndex] ?? null);
        });

        const targetRow = context.table.rows[context.rowIndex];
        const targetCell = targetRow?.cells[direction === 'left' ? context.cellIndex : context.cellIndex + 1];
        if (targetCell instanceof HTMLElement) {
          placeCaretAtStart(targetCell);
        }
      }

      queueSync();
    }, [getTableContext, queueSync]);

    const deleteCurrentRow = useCallback(() => {
      const context = getTableContext();
      if (!context) return;

      if (context.table.rows.length <= 1) {
        context.table.remove();
      } else {
        context.row.remove();
      }

      queueSync();
    }, [getTableContext, queueSync]);

    const deleteCurrentColumn = useCallback(() => {
      const context = getTableContext();
      if (!context) return;

      Array.from(context.table.rows).forEach((row) => {
        row.cells[context.cellIndex]?.remove();
      });

      if (Array.from(context.table.rows).every((row) => row.cells.length === 0)) {
        context.table.remove();
      }

      queueSync();
    }, [getTableContext, queueSync]);

    const deleteCurrentTable = useCallback(() => {
      const context = getTableContext();
      if (!context) return;

      context.table.remove();
      queueSync();
    }, [getTableContext, queueSync]);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const nextHtml = normalizeHtml(value);
      if (editor.innerHTML !== nextHtml) {
        editor.innerHTML = nextHtml;
      }
    }, [value]);

    useImperativeHandle(ref, () => ({ flushSync }), [flushSync]);

    useEffect(() => {
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, []);

    return (
      <div className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-border bg-page text-xs uppercase tracking-wider text-muted">
          Structured DOCX editor
        </div>

        <div className="border-b border-border bg-card/80 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('undo')} title="Undo">
              <Undo2 className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('redo')} title="Redo">
              <Redo2 className="h-4 w-4" />
            </button>

            <div className="mx-1 h-7 w-px bg-border" />

            <button type="button" className={toolbarWideButtonClass} onClick={() => setBlock('p')}>
              P
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => setBlock('h1')} title="Heading 1">
              <Heading1 className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => setBlock('h2')} title="Heading 2">
              <Heading2 className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => setBlock('h3')} title="Heading 3">
              <Heading3 className="h-4 w-4" />
            </button>

            <div className="mx-1 h-7 w-px bg-border" />

            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('bold')} title="Bold">
              <Bold className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('italic')} title="Italic">
              <Italic className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('underline')} title="Underline">
              <Underline className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('strikeThrough')} title="Strikethrough">
              <Strikethrough className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('removeFormat')} title="Clear formatting">
              <Eraser className="h-4 w-4" />
            </button>

            <div className="mx-1 h-7 w-px bg-border" />

            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('insertUnorderedList')} title="Bullet list">
              <List className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('insertOrderedList')} title="Numbered list">
              <ListOrdered className="h-4 w-4" />
            </button>

            <div className="mx-1 h-7 w-px bg-border" />

            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('justifyLeft')} title="Align left">
              <AlignLeft className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('justifyCenter')} title="Align center">
              <AlignCenter className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('justifyRight')} title="Align right">
              <AlignRight className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('justifyFull')} title="Justify">
              <AlignJustify className="h-4 w-4" />
            </button>

            <div className="mx-1 h-7 w-px bg-border" />

            <button type="button" className={toolbarWideButtonClass} onClick={() => insertTable(3, 3)}>
              <Table className="h-4 w-4" />
              Table
            </button>
            <button type="button" className={toolbarWideButtonClass} onClick={() => updateTable('above')}>
              <Rows3 className="h-4 w-4" />
              Row above
            </button>
            <button type="button" className={toolbarWideButtonClass} onClick={() => updateTable('below')}>
              <Rows3 className="h-4 w-4" />
              Row below
            </button>
            <button type="button" className={toolbarWideButtonClass} onClick={() => updateTable('left')}>
              <Table className="h-4 w-4" />
              Col left
            </button>
            <button type="button" className={toolbarWideButtonClass} onClick={() => updateTable('right')}>
              <Table className="h-4 w-4" />
              Col right
            </button>
            <button type="button" className={toolbarWideButtonClass} onClick={deleteCurrentRow}>
              <Trash2 className="h-4 w-4" />
              Del row
            </button>
            <button type="button" className={toolbarWideButtonClass} onClick={deleteCurrentColumn}>
              <Trash2 className="h-4 w-4" />
              Del col
            </button>
            <button type="button" className={toolbarWideButtonClass} onClick={deleteCurrentTable}>
              <Trash2 className="h-4 w-4" />
              Del table
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={queueSync}
            className="min-h-full rounded-lg bg-page border border-border p-6 text-primary focus:outline-none [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-4 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:mb-4 [&_table]:mb-6 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:align-top [&_td]:p-3 [&_th]:border [&_th]:border-border [&_th]:bg-card [&_th]:p-3 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
          />
        </div>
      </div>
    );
  },
);

HtmlDocumentEditor.displayName = 'HtmlDocumentEditor';

export default HtmlDocumentEditor;
