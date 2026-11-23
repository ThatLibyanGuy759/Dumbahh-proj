import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { colIndexToLetter } from "@/lib/utils";
import { useSpreadsheetStore } from "@/stores/spreadsheetStore";
import type { CellData, CellPosition } from "@/types";

const MIN_ROWS = 60;
const MIN_COLS = 26; // A-Z
const DEFAULT_COL_WIDTH = 85;

const BORDER_CSS: Record<string, string> = {
  thin: "1px solid #000",
  medium: "2px solid #000",
  thick: "3px solid #000",
  double: "3px double #000",
};

/** "top:thin;bottom:double" -> CSS border properties */
function borderStyle(spec?: string): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (!spec) return style;
  for (const part of spec.split(";")) {
    const [side, kind] = part.split(":").map((x) => x?.trim());
    const css = BORDER_CSS[kind];
    if (!css) continue;
    if (side === "top") style.borderTop = css;
    if (side === "bottom") style.borderBottom = css;
    if (side === "left") style.borderLeft = css;
    if (side === "right") style.borderRight = css;
  }
  return style;
}

// Memoized individual cell
const Cell = memo(function Cell({
  row,
  col,
  rowSpan,
  colSpan,
  isSelected,
  isInRange,
  isEditing,
  editValue,
  cellData,
  displayValue,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
  onChangeEdit,
  onKeyDownEdit,
}: {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  isSelected: boolean;
  isInRange: boolean;
  isEditing: boolean;
  editValue: string;
  cellData?: CellData;
  displayValue: string;
  onMouseDown: (e: React.MouseEvent, row: number, col: number) => void;
  onMouseEnter: (row: number, col: number) => void;
  onDoubleClick: (row: number, col: number) => void;
  onChangeEdit: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDownEdit: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const isNumeric = cellData?.format_type === "currency" || cellData?.format_type === "accounting";
  const style: React.CSSProperties = {
    fontWeight: cellData?.font_bold ? "bold" : "normal",
    fontStyle: cellData?.font_italic ? "italic" : "normal",
    fontSize: cellData?.font_size ? `${cellData.font_size}px` : undefined,
    textAlign: cellData?.text_align || (isNumeric ? "right" : "left"),
    color: cellData?.font_color || "#000000",
    backgroundColor: isSelected
      ? "#e0e7ff"
      : isInRange
      ? "#f1f5f9"
      : cellData?.bg_color || "transparent",
    whiteSpace: "pre",
    ...borderStyle(cellData?.border),
  };

  return (
    <td
      rowSpan={rowSpan > 1 ? rowSpan : undefined}
      colSpan={colSpan > 1 ? colSpan : undefined}
      onMouseDown={(e) => onMouseDown(e, row, col)}
      onMouseEnter={() => onMouseEnter(row, col)}
      onDoubleClick={() => onDoubleClick(row, col)}
      style={style}
      className={`spreadsheet-cell border-r border-b border-gray-200 text-xs px-2 py-1 select-none relative overflow-hidden text-ellipsis ${
        isSelected ? "ring-2 ring-blue-600 ring-inset z-10" : ""
      }`}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={onChangeEdit}
          onKeyDown={onKeyDownEdit}
          className="absolute inset-0 w-full h-full px-2 py-1 text-xs font-mono bg-white outline-none z-20"
        />
      ) : (
        <span>{displayValue}</span>
      )}
    </td>
  );
});

export default function SpreadsheetGrid() {
  const cells = useSpreadsheetStore((s) => s.cells);
  const sheets = useSpreadsheetStore((s) => s.sheets);
  const activeSheetId = useSpreadsheetStore((s) => s.activeSheetId);
  const selectedCell = useSpreadsheetStore((s) => s.selectedCell);
  const selectedRange = useSpreadsheetStore((s) => s.selectedRange);
  const selectCell = useSpreadsheetStore((s) => s.selectCell);
  const selectRange = useSpreadsheetStore((s) => s.selectRange);
  const isEditing = useSpreadsheetStore((s) => s.isEditing);
  const editValue = useSpreadsheetStore((s) => s.editValue);
  const startEditing = useSpreadsheetStore((s) => s.startEditing);
  const stopEditing = useSpreadsheetStore((s) => s.stopEditing);
  const setEditValue = useSpreadsheetStore((s) => s.setEditValue);
  const clearCells = useSpreadsheetStore((s) => s.clearCells);
  const copyCells = useSpreadsheetStore((s) => s.copyCells);
  const pasteCells = useSpreadsheetStore((s) => s.pasteCells);
  const undo = useSpreadsheetStore((s) => s.undo);
  const redo = useSpreadsheetStore((s) => s.redo);
  const saveCells = useSpreadsheetStore((s) => s.saveCells);
  const getDisplayValue = useSpreadsheetStore((s) => s.getDisplayValue);

  const sheet = sheets.find((s) => s.id === activeSheetId);
  const ROW_COUNT = Math.max(sheet?.row_count || 0, MIN_ROWS);
  const COL_COUNT = Math.max(sheet?.col_count || 0, MIN_COLS);
  const colWidth = (c: number) => Number(sheet?.col_widths?.[String(c)]) || DEFAULT_COL_WIDTH;

  // Merged cells: master cell -> span, covered cells -> skipped
  const { spans, covered } = useMemo(() => {
    const spans = new Map<string, { rs: number; cs: number }>();
    const covered = new Set<string>();
    for (const m of sheet?.merges || []) {
      const rs = Math.max(1, m.rs || 1);
      const cs = Math.max(1, m.cs || 1);
      spans.set(`${m.r},${m.c}`, { rs, cs });
      for (let r = m.r; r < m.r + rs; r++) {
        for (let c = m.c; c < m.c + cs; c++) {
          if (r !== m.r || c !== m.c) covered.add(`${r},${c}`);
        }
      }
    }
    return { spans, covered };
  }, [sheet?.merges]);

  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragStart, setDragStart] = useState<CellPosition | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return;
      // Ignore keys typed into inputs elsewhere on the page (e.g., formula bar, sheet rename)
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const active = selectedCell || { row: 0, col: 0 };

      // Ctrl shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "c" || e.key === "C") {
          e.preventDefault();
          copyCells();
          return;
        }
        if (e.key === "v" || e.key === "V") {
          e.preventDefault();
          pasteCells();
          return;
        }
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          undo();
          return;
        }
        if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          redo();
          return;
        }
        if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          saveCells();
          return;
        }
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          if (active.row > 0) selectCell({ row: active.row - 1, col: active.col });
          break;
        case "ArrowDown":
          e.preventDefault();
          if (active.row < ROW_COUNT - 1) selectCell({ row: active.row + 1, col: active.col });
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (active.col > 0) selectCell({ row: active.row, col: active.col - 1 });
          break;
        case "ArrowRight":
          e.preventDefault();
          if (active.col < COL_COUNT - 1) selectCell({ row: active.row, col: active.col + 1 });
          break;
        case "Tab":
          e.preventDefault();
          if (active.col < COL_COUNT - 1) selectCell({ row: active.row, col: active.col + 1 });
          break;
        case "Enter":
          e.preventDefault();
          startEditing();
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          if (selectedRange) {
            const minR = Math.min(selectedRange.start.row, selectedRange.end.row);
            const maxR = Math.max(selectedRange.start.row, selectedRange.end.row);
            const minC = Math.min(selectedRange.start.col, selectedRange.end.col);
            const maxC = Math.max(selectedRange.start.col, selectedRange.end.col);
            const positions: CellPosition[] = [];
            for (let r = minR; r <= maxR; r++) {
              for (let c = minC; c <= maxC; c++) {
                positions.push({ row: r, col: c });
              }
            }
            clearCells(positions);
          } else {
            clearCells([active]);
          }
          break;
        default:
          // If alphanumeric or symbol typed, start editing directly
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            startEditing(e.key);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCell, selectedRange, isEditing, copyCells, pasteCells, undo, redo, saveCells, selectCell, startEditing, clearCells, ROW_COUNT, COL_COUNT]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      if (isEditing) {
        stopEditing(true);
      }
      if (e.shiftKey && selectedCell) {
        selectRange({ start: selectedCell, end: { row, col } });
      } else {
        selectCell({ row, col });
        setDragStart({ row, col });
        setIsMouseDown(true);
      }
    },
    [isEditing, selectedCell, selectCell, selectRange, stopEditing]
  );

  const handleMouseEnter = useCallback(
    (row: number, col: number) => {
      if (isMouseDown && dragStart) {
        selectRange({ start: dragStart, end: { row, col } });
      }
    },
    [isMouseDown, dragStart, selectRange]
  );

  useEffect(() => {
    const handleMouseUp = () => setIsMouseDown(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const handleDoubleClick = useCallback(
    (row: number, col: number) => {
      selectCell({ row, col });
      startEditing();
    },
    [selectCell, startEditing]
  );

  const handleKeyDownEdit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      stopEditing(true);
      if (selectedCell && selectedCell.row < ROW_COUNT - 1) {
        selectCell({ row: selectedCell.row + 1, col: selectedCell.col });
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      stopEditing(true);
      if (selectedCell && selectedCell.col < COL_COUNT - 1) {
        selectCell({ row: selectedCell.row, col: selectedCell.col + 1 });
      }
    } else if (e.key === "Escape") {
      stopEditing(false);
    }
  };

  const isCellInRange = (row: number, col: number) => {
    if (!selectedRange) return false;
    const minR = Math.min(selectedRange.start.row, selectedRange.end.row);
    const maxR = Math.max(selectedRange.start.row, selectedRange.end.row);
    const minC = Math.min(selectedRange.start.col, selectedRange.end.col);
    const maxC = Math.max(selectedRange.start.col, selectedRange.end.col);
    return row >= minR && row <= maxR && col >= minC && col <= maxC;
  };

  const tableWidth = 40 + Array.from({ length: COL_COUNT }).reduce<number>((sum, _, c) => sum + colWidth(c), 0);

  return (
    <div
      ref={gridContainerRef}
      className="flex-1 overflow-auto bg-white border border-gray-200 outline-none"
      tabIndex={0}
    >
      <table className="border-collapse table-fixed" style={{ width: tableWidth }}>
        <colgroup>
          <col style={{ width: 40 }} />
          {Array.from({ length: COL_COUNT }).map((_, c) => (
            <col key={c} style={{ width: colWidth(c) }} />
          ))}
        </colgroup>
        <thead>
          <tr className="sticky top-0 z-20 bg-gray-100 shadow-2xs">
            {/* Top-left corner */}
            <th className="h-7 border-r border-b border-gray-300 bg-gray-200 text-gray-500 text-[11px] font-semibold text-center select-none sticky left-0 z-30" />
            {Array.from({ length: COL_COUNT }).map((_, c) => (
              <th
                key={c}
                className="h-7 border-r border-b border-gray-300 bg-gray-100 text-gray-600 text-xs font-semibold text-center select-none"
              >
                {colIndexToLetter(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROW_COUNT }).map((_, r) => (
            <tr key={r}>
              {/* Row number header */}
              <td className="h-6 border-r border-b border-gray-300 bg-gray-100 text-gray-500 text-[11px] font-semibold text-center select-none sticky left-0 z-10">
                {r + 1}
              </td>
              {Array.from({ length: COL_COUNT }).map((_, c) => {
                const key = `${r},${c}`;
                if (covered.has(key)) return null;
                const span = spans.get(key);
                const cell = cells.get(key);
                const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                const inRange = isCellInRange(r, c);
                const editing = isSelected && isEditing;
                const displayVal = cell ? getDisplayValue(cell) : "";

                return (
                  <Cell
                    key={key}
                    row={r}
                    col={c}
                    rowSpan={span?.rs || 1}
                    colSpan={span?.cs || 1}
                    isSelected={isSelected}
                    isInRange={inRange}
                    isEditing={editing}
                    editValue={editValue}
                    cellData={cell}
                    displayValue={displayVal}
                    onMouseDown={handleMouseDown}
                    onMouseEnter={handleMouseEnter}
                    onDoubleClick={handleDoubleClick}
                    onChangeEdit={(e) => setEditValue(e.target.value)}
                    onKeyDownEdit={handleKeyDownEdit}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
