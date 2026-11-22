import React, { useEffect, useRef, useState, useCallback, memo } from "react";
import { colIndexToLetter, cellRef } from "@/lib/utils";
import { useSpreadsheetStore } from "@/stores/spreadsheetStore";
import type { CellData, CellPosition } from "@/types";

const ROW_COUNT = 60;
const COL_COUNT = 26; // A-Z

// Memoized individual cell
const Cell = memo(function Cell({
  row,
  col,
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

  const style: React.CSSProperties = {
    fontWeight: cellData?.font_bold ? "bold" : "normal",
    fontStyle: cellData?.font_italic ? "italic" : "normal",
    textAlign: cellData?.text_align || "left",
    color: cellData?.font_color || "#000000",
    backgroundColor: isSelected
      ? "#e0e7ff"
      : isInRange
      ? "#f1f5f9"
      : cellData?.bg_color || "transparent",
  };

  return (
    <td
      onMouseDown={(e) => onMouseDown(e, row, col)}
      onMouseEnter={() => onMouseEnter(row, col)}
      onDoubleClick={() => onDoubleClick(row, col)}
      style={style}
      className={`spreadsheet-cell border-r border-b border-gray-200 text-xs px-2 py-1 select-none relative min-w-[85px] max-w-[150px] truncate ${
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
  const selectedCell = useSpreadsheetStore((s) => s.selectedCell);
  const selectedRange = useSpreadsheetStore((s) => s.selectedRange);
  const selectCell = useSpreadsheetStore((s) => s.selectCell);
  const selectRange = useSpreadsheetStore((s) => s.selectRange);
  const isEditing = useSpreadsheetStore((s) => s.isEditing);
  const editValue = useSpreadsheetStore((s) => s.editValue);
  const startEditing = useSpreadsheetStore((s) => s.startEditing);
  const stopEditing = useSpreadsheetStore((s) => s.stopEditing);
  const setEditValue = useSpreadsheetStore((s) => s.setEditValue);
  const setCellValue = useSpreadsheetStore((s) => s.setCellValue);
  const clearCells = useSpreadsheetStore((s) => s.clearCells);
  const copyCells = useSpreadsheetStore((s) => s.copyCells);
  const pasteCells = useSpreadsheetStore((s) => s.pasteCells);
  const undo = useSpreadsheetStore((s) => s.undo);
  const redo = useSpreadsheetStore((s) => s.redo);
  const saveCells = useSpreadsheetStore((s) => s.saveCells);
  const getDisplayValue = useSpreadsheetStore((s) => s.getDisplayValue);

  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragStart, setDragStart] = useState<CellPosition | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return;

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
  }, [selectedCell, selectedRange, isEditing, copyCells, pasteCells, undo, redo, saveCells, selectCell, startEditing, clearCells]);

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

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  useEffect(() => {
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

  return (
    <div
      ref={gridContainerRef}
      className="flex-1 overflow-auto bg-white border border-gray-200 outline-none"
      tabIndex={0}
    >
      <table className="border-collapse table-fixed w-full">
        <thead>
          <tr className="sticky top-0 z-20 bg-gray-100 shadow-2xs">
            {/* Top-left corner */}
            <th className="w-10 min-w-10 h-7 border-r border-b border-gray-300 bg-gray-200 text-gray-500 text-[11px] font-semibold text-center select-none sticky left-0 z-30" />
            {Array.from({ length: COL_COUNT }).map((_, c) => (
              <th
                key={c}
                className="min-w-[85px] max-w-[150px] h-7 border-r border-b border-gray-300 bg-gray-100 text-gray-600 text-xs font-semibold text-center select-none"
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
              <td className="w-10 min-w-10 h-6 border-r border-b border-gray-300 bg-gray-100 text-gray-500 text-[11px] font-semibold text-center select-none sticky left-0 z-10">
                {r + 1}
              </td>
              {Array.from({ length: COL_COUNT }).map((_, c) => {
                const cell = cells.get(`${r},${c}`);
                const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                const inRange = isCellInRange(r, c);
                const editing = isSelected && isEditing;
                const displayVal = cell ? getDisplayValue(cell) : "";

                return (
                  <Cell
                    key={`${r},${c}`}
                    row={r}
                    col={c}
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
