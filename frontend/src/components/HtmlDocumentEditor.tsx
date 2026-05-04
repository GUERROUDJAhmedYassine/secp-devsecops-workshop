import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react';
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

interface ToolbarState {
  block: 'p' | 'h1' | 'h2' | 'h3';
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  unorderedList: boolean;
  orderedList: boolean;
  alignment: 'left' | 'center' | 'right' | 'justify';
  inTable: boolean;
}

const defaultToolbarState: ToolbarState = {
  block: 'p',
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  unorderedList: false,
  orderedList: false,
  alignment: 'left',
  inTable: false,
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function normalizeIncomingDocumentHtml(html: string): string {
  const normalized = normalizeHtml(html).replace(/\r\n/g, '\n');
  const decoded = decodeHtmlEntities(normalized);
  const candidate = looksLikeHtml(decoded) ? decoded : normalized;

  if (!looksLikeHtml(candidate)) {
    return candidate
      .split('\n')
      .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>'))
      .join('');
  }

  const repaired = candidate.replace(/^([^<]+)<\/p>/i, '<p>$1</p>');
  const template = document.createElement('template');
  template.innerHTML = repaired;

  const hasParsedElements = Array.from(template.content.childNodes).some(
    (node) => node.nodeType === Node.ELEMENT_NODE,
  );

  return hasParsedElements ? trimEmptyLeadingParagraphs(template.innerHTML) : normalizeHtml(candidate);
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

function placeCaretAtEnd(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);

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

const toolbarActiveClass =
  'border-[#4f8ef7]/60 bg-[#4f8ef7]/15 text-primary shadow-[inset_0_0_0_1px_rgba(79,142,247,0.25)]';

const toolbarDisabledClass =
  'cursor-not-allowed opacity-40 hover:border-border hover:bg-page hover:text-muted';

function joinClasses(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const HtmlDocumentEditor = forwardRef<HtmlDocumentEditorRef, HtmlDocumentEditorProps>(
  ({ value, onChange }, ref) => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const undoStackRef = useRef<string[]>([]);
    const redoStackRef = useRef<string[]>([]);
    const lastSnapshotRef = useRef<string>('');
    const savedRangeRef = useRef<Range | null>(null);
    const [toolbarState, setToolbarState] = useState<ToolbarState>(defaultToolbarState);

    const queueSync = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const nextHtml = normalizeHtml(editor.innerHTML);
      lastSnapshotRef.current = nextHtml;
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

    const pushHistorySnapshot = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const currentHtml = normalizeHtml(editor.innerHTML);
      const previousSnapshot = lastSnapshotRef.current;
      const snapshotToStore = previousSnapshot || currentHtml;
      const undoStack = undoStackRef.current;

      if (undoStack[undoStack.length - 1] !== snapshotToStore) {
        undoStack.push(snapshotToStore);
      }
      redoStackRef.current = [];
    }, []);

    const restoreSnapshot = useCallback((html: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.innerHTML = normalizeHtml(html);
      lastSnapshotRef.current = normalizeHtml(editor.innerHTML);
      placeCaretAtEnd(editor);
      onChange(lastSnapshotRef.current);
    }, [onChange]);

    const undo = useCallback(() => {
      const editor = editorRef.current;
      const previousHtml = undoStackRef.current.pop();
      if (!editor || previousHtml === undefined) return;

      redoStackRef.current.push(normalizeHtml(editor.innerHTML));
      restoreSnapshot(previousHtml);
    }, [restoreSnapshot]);

    const redo = useCallback(() => {
      const editor = editorRef.current;
      const nextHtml = redoStackRef.current.pop();
      if (!editor || nextHtml === undefined) return;

      undoStackRef.current.push(normalizeHtml(editor.innerHTML));
      restoreSnapshot(nextHtml);
    }, [restoreSnapshot]);

    const isRangeInsideEditor = useCallback((range: Range): boolean => {
      const editor = editorRef.current;
      if (!editor) return false;

      const container =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;

      return container instanceof Node && editor.contains(container);
    }, []);

    const saveCurrentSelection = useCallback(() => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;

      const range = selection.getRangeAt(0);
      if (isRangeInsideEditor(range)) {
        savedRangeRef.current = range.cloneRange();
      }
    }, [isRangeInsideEditor]);

    const restoreEditorSelection = useCallback((): Range | null => {
      const editor = editorRef.current;
      if (!editor) return null;

      editor.focus();
      const selection = window.getSelection();
      const savedRange = savedRangeRef.current;

      if (selection && savedRange && isRangeInsideEditor(savedRange)) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
        return savedRange;
      }

      placeCaretAtEnd(editor);
      const nextSelection = window.getSelection();
      return nextSelection?.rangeCount ? nextSelection.getRangeAt(0) : null;
    }, [isRangeInsideEditor]);

    const getSafeEditorRange = useCallback((): Range | null => {
      const selection = window.getSelection();

      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        if (isRangeInsideEditor(range)) {
          savedRangeRef.current = range.cloneRange();
          return range;
        }
      }

      return restoreEditorSelection();
    }, [isRangeInsideEditor, restoreEditorSelection]);

    const canApplyBlockLevelCommand = useCallback((range: Range | null): boolean => {
      const editor = editorRef.current;
      if (!editor || !range) return false;
      if (!range.collapsed) return true;

      const anchorNode = range.startContainer;
      const blockElement = findClosestElement(anchorNode, ['P', 'H1', 'H2', 'H3', 'LI', 'TD', 'TH'], editor);
      const text = blockElement?.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
      return text.length === 0;
    }, []);

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

    const refreshToolbarState = useCallback(() => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode;

      if (!editor || !anchorNode || !editor.contains(anchorNode)) {
        setToolbarState((current) => ({ ...current, inTable: false }));
        return;
      }

      const blockElement = findClosestElement(anchorNode, ['P', 'H1', 'H2', 'H3', 'LI', 'TD', 'TH'], editor);
      const parentList = findClosestElement(anchorNode, ['UL', 'OL'], editor);
      const computedStyle = blockElement instanceof HTMLElement ? window.getComputedStyle(blockElement) : null;
      const textAlign = computedStyle?.textAlign ?? 'left';
      const alignment: ToolbarState['alignment'] =
        textAlign === 'center' || textAlign === 'right' || textAlign === 'justify' ? textAlign : 'left';
      const blockTag = blockElement?.tagName;

      setToolbarState({
        block: blockTag === 'H1' || blockTag === 'H2' || blockTag === 'H3' ? blockTag.toLowerCase() as ToolbarState['block'] : 'p',
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        unorderedList: parentList?.tagName === 'UL',
        orderedList: parentList?.tagName === 'OL',
        alignment,
        inTable: Boolean(findClosestElement(anchorNode, ['TD', 'TH'], editor)),
      });
    }, []);

    const updateToolbarStateForCommand = useCallback((command: string, value?: string) => {
      setToolbarState((current) => {
        switch (command) {
          case 'formatBlock': {
            const block = (value?.replace(/[<>]/g, '') || 'p') as ToolbarState['block'];
            return { ...current, block };
          }
          case 'bold':
            return { ...current, bold: !current.bold };
          case 'italic':
            return { ...current, italic: !current.italic };
          case 'underline':
            return { ...current, underline: !current.underline };
          case 'strikeThrough':
            return { ...current, strike: !current.strike };
          case 'insertUnorderedList':
            return { ...current, unorderedList: !current.unorderedList, orderedList: false };
          case 'insertOrderedList':
            return { ...current, orderedList: !current.orderedList, unorderedList: false };
          case 'justifyLeft':
            return { ...current, alignment: 'left' };
          case 'justifyCenter':
            return { ...current, alignment: 'center' };
          case 'justifyRight':
            return { ...current, alignment: 'right' };
          case 'justifyFull':
            return { ...current, alignment: 'justify' };
          case 'removeFormat':
            return {
              ...current,
              bold: false,
              italic: false,
              underline: false,
              strike: false,
            };
          default:
            return current;
        }
      });
    }, []);

    const runCommand = useCallback((command: string, value?: string) => {
      const range = restoreEditorSelection();
      const isBlockLevelCommand = [
        'insertUnorderedList',
        'insertOrderedList',
        'justifyLeft',
        'justifyCenter',
        'justifyRight',
        'justifyFull',
      ].includes(command);

      if (isBlockLevelCommand && !canApplyBlockLevelCommand(range)) {
        return;
      }

      pushHistorySnapshot();
      const commandValue = command === 'formatBlock' && value ? `<${value}>` : value;
      document.execCommand(command, false, commandValue);
      updateToolbarStateForCommand(command, value);
      saveCurrentSelection();
      window.setTimeout(() => {
        saveCurrentSelection();
        refreshToolbarState();
      }, 0);
      queueSync();
    }, [
      pushHistorySnapshot,
      queueSync,
      refreshToolbarState,
      restoreEditorSelection,
      saveCurrentSelection,
      updateToolbarStateForCommand,
      canApplyBlockLevelCommand,
    ]);

    const setBlock = useCallback((tag: 'p' | 'h1' | 'h2' | 'h3') => {
      runCommand('formatBlock', tag);
    }, [runCommand]);

    const insertTable = useCallback((rows = 3, cols = 3) => {
      const editor = editorRef.current;
      if (!editor) return;

      const range = getSafeEditorRange();
      if (!range) return;
      pushHistorySnapshot();
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
          saveCurrentSelection();
          refreshToolbarState();
        }

        queueSync();
    }, [getSafeEditorRange, pushHistorySnapshot, queueSync, refreshToolbarState, saveCurrentSelection]);

    const updateTable = useCallback((direction: TablePosition) => {
      const context = getTableContext();
      if (!context) return;

      pushHistorySnapshot();

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
          saveCurrentSelection();
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
          saveCurrentSelection();
        }
      }

      queueSync();
      refreshToolbarState();
    }, [getTableContext, pushHistorySnapshot, queueSync, refreshToolbarState, saveCurrentSelection]);

    const deleteCurrentRow = useCallback(() => {
      const context = getTableContext();
      if (!context) return;

      pushHistorySnapshot();

      if (context.table.rows.length <= 1) {
        context.table.remove();
      } else {
        context.row.remove();
      }

      queueSync();
      refreshToolbarState();
    }, [getTableContext, pushHistorySnapshot, queueSync, refreshToolbarState]);

    const deleteCurrentColumn = useCallback(() => {
      const context = getTableContext();
      if (!context) return;

      pushHistorySnapshot();

      Array.from(context.table.rows).forEach((row) => {
        row.cells[context.cellIndex]?.remove();
      });

      if (Array.from(context.table.rows).every((row) => row.cells.length === 0)) {
        context.table.remove();
      }

      queueSync();
      refreshToolbarState();
    }, [getTableContext, pushHistorySnapshot, queueSync, refreshToolbarState]);

    const deleteCurrentTable = useCallback(() => {
      const context = getTableContext();
      if (!context) return;

      pushHistorySnapshot();
      context.table.remove();
      queueSync();
      refreshToolbarState();
    }, [getTableContext, pushHistorySnapshot, queueSync, refreshToolbarState]);

    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
      const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
      const isRedo =
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z');

      if (isUndo) {
        event.preventDefault();
        undo();
      } else if (isRedo) {
        event.preventDefault();
        redo();
      }
    }, [redo, undo]);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const nextHtml = normalizeIncomingDocumentHtml(value);
      if (editor.innerHTML !== nextHtml) {
        editor.innerHTML = nextHtml;
      }
      lastSnapshotRef.current = nextHtml;
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

        <div className="border-b border-border bg-card/80 px-3 py-3" onMouseDown={(event) => event.preventDefault()}>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={toolbarButtonClass} onClick={undo} title="Undo">
              <Undo2 className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={redo} title="Redo">
              <Redo2 className="h-4 w-4" />
            </button>

            <div className="mx-1 h-7 w-px bg-border" />

            <button type="button" className={joinClasses(toolbarWideButtonClass, toolbarState.block === 'p' && toolbarActiveClass)} onClick={() => setBlock('p')}>
              P
            </button>
            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.block === 'h1' && toolbarActiveClass)} onClick={() => setBlock('h1')} title="Heading 1">
              <Heading1 className="h-4 w-4" />
            </button>
            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.block === 'h2' && toolbarActiveClass)} onClick={() => setBlock('h2')} title="Heading 2">
              <Heading2 className="h-4 w-4" />
            </button>
            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.block === 'h3' && toolbarActiveClass)} onClick={() => setBlock('h3')} title="Heading 3">
              <Heading3 className="h-4 w-4" />
            </button>

            <div className="mx-1 h-7 w-px bg-border" />

            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.bold && toolbarActiveClass)} onClick={() => runCommand('bold')} title="Bold">
              <Bold className="h-4 w-4" />
            </button>
            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.italic && toolbarActiveClass)} onClick={() => runCommand('italic')} title="Italic">
              <Italic className="h-4 w-4" />
            </button>
            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.underline && toolbarActiveClass)} onClick={() => runCommand('underline')} title="Underline">
              <Underline className="h-4 w-4" />
            </button>
            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.strike && toolbarActiveClass)} onClick={() => runCommand('strikeThrough')} title="Strikethrough">
              <Strikethrough className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('removeFormat')} title="Clear formatting">
              <Eraser className="h-4 w-4" />
            </button>

            <div className="mx-1 h-7 w-px bg-border" />

            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.unorderedList && toolbarActiveClass)} onClick={() => runCommand('insertUnorderedList')} title="Bullet list">
              <List className="h-4 w-4" />
            </button>
            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.orderedList && toolbarActiveClass)} onClick={() => runCommand('insertOrderedList')} title="Numbered list">
              <ListOrdered className="h-4 w-4" />
            </button>

            <div className="mx-1 h-7 w-px bg-border" />

            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.alignment === 'left' && toolbarActiveClass)} onClick={() => runCommand('justifyLeft')} title="Align left">
              <AlignLeft className="h-4 w-4" />
            </button>
            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.alignment === 'center' && toolbarActiveClass)} onClick={() => runCommand('justifyCenter')} title="Align center">
              <AlignCenter className="h-4 w-4" />
            </button>
            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.alignment === 'right' && toolbarActiveClass)} onClick={() => runCommand('justifyRight')} title="Align right">
              <AlignRight className="h-4 w-4" />
            </button>
            <button type="button" className={joinClasses(toolbarButtonClass, toolbarState.alignment === 'justify' && toolbarActiveClass)} onClick={() => runCommand('justifyFull')} title="Justify">
              <AlignJustify className="h-4 w-4" />
            </button>

            <div className="mx-1 h-7 w-px bg-border" />

            <button type="button" className={toolbarWideButtonClass} onClick={() => insertTable(3, 3)}>
              <Table className="h-4 w-4" />
              Table
            </button>
            <button type="button" disabled={!toolbarState.inTable} className={joinClasses(toolbarWideButtonClass, !toolbarState.inTable && toolbarDisabledClass)} onClick={() => updateTable('above')}>
              <Rows3 className="h-4 w-4" />
              Row above
            </button>
            <button type="button" disabled={!toolbarState.inTable} className={joinClasses(toolbarWideButtonClass, !toolbarState.inTable && toolbarDisabledClass)} onClick={() => updateTable('below')}>
              <Rows3 className="h-4 w-4" />
              Row below
            </button>
            <button type="button" disabled={!toolbarState.inTable} className={joinClasses(toolbarWideButtonClass, !toolbarState.inTable && toolbarDisabledClass)} onClick={() => updateTable('left')}>
              <Table className="h-4 w-4" />
              Col left
            </button>
            <button type="button" disabled={!toolbarState.inTable} className={joinClasses(toolbarWideButtonClass, !toolbarState.inTable && toolbarDisabledClass)} onClick={() => updateTable('right')}>
              <Table className="h-4 w-4" />
              Col right
            </button>
            <button type="button" disabled={!toolbarState.inTable} className={joinClasses(toolbarWideButtonClass, !toolbarState.inTable && toolbarDisabledClass)} onClick={deleteCurrentRow}>
              <Trash2 className="h-4 w-4" />
              Del row
            </button>
            <button type="button" disabled={!toolbarState.inTable} className={joinClasses(toolbarWideButtonClass, !toolbarState.inTable && toolbarDisabledClass)} onClick={deleteCurrentColumn}>
              <Trash2 className="h-4 w-4" />
              Del col
            </button>
            <button type="button" disabled={!toolbarState.inTable} className={joinClasses(toolbarWideButtonClass, !toolbarState.inTable && toolbarDisabledClass)} onClick={deleteCurrentTable}>
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
            onBeforeInput={pushHistorySnapshot}
            onFocus={() => {
              saveCurrentSelection();
              refreshToolbarState();
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={() => {
              saveCurrentSelection();
              refreshToolbarState();
            }}
            onMouseUp={() => {
              saveCurrentSelection();
              refreshToolbarState();
            }}
            onInput={() => {
              saveCurrentSelection();
              refreshToolbarState();
              queueSync();
            }}
            className="min-h-full rounded-lg bg-page border border-border p-6 text-primary focus:outline-none [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-4 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:mb-4 [&_table]:mb-6 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:align-top [&_td]:p-3 [&_th]:border [&_th]:border-border [&_th]:bg-card [&_th]:p-3 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
          />
        </div>
      </div>
    );
  },
);

HtmlDocumentEditor.displayName = 'HtmlDocumentEditor';

export default HtmlDocumentEditor;
