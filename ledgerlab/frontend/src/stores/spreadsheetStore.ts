import { create } from "zustand";
import type { CellData, CellPosition, CellRange, SheetData, WorkbookData } from "@/types";
import { sheetsApi, workbooksApi } from "@/lib/api";
import { HyperFormula } from "hyperformula";

interface SpreadsheetState {
  // Current workbook & sheet
  workbook: WorkbookData | null;
  sheets: SheetData[];
  activeSheetId: number | null;
  cells: Map<string, CellData>; // key: "row,col"

  // Selection
  selectedCell: CellPosition | null;
  selectedRange: CellRange | null;
  isEditing: boolean;
  editValue: string;

  // Formula engine
  hf: HyperFormula | null;

  // Clipboard
  clipboard: CellData[] | null;
  clipboardRange: CellRange | null;

  // Undo/redo
  undoStack: Map<string, CellData>[];
  redoStack: Map<string, CellData>[];

  // Auto-save
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;

  // Actions
  loadWorkbook: (id: number) => Promise<void>;
  loadSheet: (sheetId: number) => Promise<void>;
  setActiveSheet: (sheetId: number) => void;
  addSheet: () => Promise<void>;
  renameSheet: (sheetId: number, name: string) => Promise<void>;
  deleteSheet: (sheetId: number) => Promise<void>;

  selectCell: (pos: CellPosition) => void;
  selectRange: (range: CellRange) => void;
  startEditing: (value?: string) => void;
  stopEditing: (save?: boolean) => void;
  setEditValue: (value: string) => void;

  setCellValue: (row: number, col: number, value: string) => void;
  setCellFormat: (cells: CellPosition[], format: Partial<CellData>) => void;
  clearCells: (cells: CellPosition[]) => void;
  copyCells: () => void;
  pasteCells: () => void;

  undo: () => void;
  redo: () => void;

  saveCells: () => Promise<void>;

  getCellKey: (row: number, col: number) => string;
  getCell: (row: number, col: number) => CellData | undefined;
  getDisplayValue: (cell: CellData) => string;
}

const DEFAULT_CELL: Omit<CellData, "row" | "col"> = {
  raw_value: "",
  computed_value: "",
  data_type: "string",
  format_type: "general",
  decimal_places: 2,
  font_bold: false,
  font_italic: false,
  font_size: 12,
  font_color: "#000000",
  bg_color: "",
  text_align: "left",
  border: "",
};

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function initHyperFormula(): HyperFormula {
  return HyperFormula.buildEmpty({
    licenseKey: "gpl-v3",
    precisionRounding: 10,
  });
}

function computeFormulas(
  hf: HyperFormula,
  cells: Map<string, CellData>,
  rowCount: number,
  colCount: number
): Map<string, CellData> {
  // Build data array for HyperFormula
  const data: (string | number | null)[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const row: (string | number | null)[] = [];
    for (let c = 0; c < colCount; c++) {
      const cell = cells.get(cellKey(r, c));
      if (cell && cell.raw_value) {
        if (cell.raw_value.startsWith("=")) {
          row.push(cell.raw_value);
        } else {
          const num = Number(cell.raw_value);
          row.push(isNaN(num) ? cell.raw_value : num);
        }
      } else {
        row.push(null);
      }
    }
    data.push(row);
  }

  // Replace sheet in HyperFormula
  const sheetNames = hf.getSheetNames();
  if (sheetNames.length > 0) {
    hf.removeSheet(hf.getSheetId(sheetNames[0])!);
  }
  hf.addSheet("Sheet");
  const sheetId = hf.getSheetId("Sheet")!;
  if (data.length > 0) {
    hf.setSheetContent(sheetId, data);
  }

  // Update computed values
  const updated = new Map(cells);
  for (const [key, cell] of updated) {
    if (cell.raw_value.startsWith("=")) {
      try {
        const val = hf.getCellValue({ sheet: sheetId, row: cell.row, col: cell.col });
        const computedCell = { ...cell };
        if (typeof val === "number") {
          computedCell.computed_value = String(val);
          computedCell.data_type = "formula";
        } else if (val instanceof Object && "type" in val) {
          computedCell.computed_value = "#ERROR!";
          computedCell.data_type = "formula";
        } else {
          computedCell.computed_value = String(val ?? "");
          computedCell.data_type = "formula";
        }
        updated.set(key, computedCell);
      } catch {
        const computedCell = { ...cell, computed_value: "#ERROR!", data_type: "formula" as const };
        updated.set(key, computedCell);
      }
    }
  }

  return updated;
}

export const useSpreadsheetStore = create<SpreadsheetState>((set, get) => ({
  workbook: null,
  sheets: [],
  activeSheetId: null,
  cells: new Map(),
  selectedCell: null,
  selectedRange: null,
  isEditing: false,
  editValue: "",
  hf: null,
  clipboard: null,
  clipboardRange: null,
  undoStack: [],
  redoStack: [],
  isDirty: false,
  isSaving: false,
  lastSaved: null,

  getCellKey: cellKey,

  getCell: (row: number, col: number) => {
    return get().cells.get(cellKey(row, col));
  },

  getDisplayValue: (cell: CellData) => {
    const val = cell.data_type === "formula" ? cell.computed_value : (cell.computed_value || cell.raw_value);
    if (!val) return "";

    const num = Number(val);
    if (isNaN(num)) return val;

    switch (cell.format_type) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency", currency: "USD",
          minimumFractionDigits: cell.decimal_places,
          maximumFractionDigits: cell.decimal_places,
        }).format(num);
      case "percentage":
        return `${(num * 100).toFixed(cell.decimal_places)}%`;
      case "number":
        return num.toFixed(cell.decimal_places);
      default:
        return val;
    }
  },

  loadWorkbook: async (id: number) => {
    const workbook = await workbooksApi.get(id);
    const hf = get().hf || initHyperFormula();
    set({ workbook, sheets: workbook.sheets || [], hf });
    if (workbook.sheets && workbook.sheets.length > 0) {
      await get().loadSheet(workbook.sheets[0].id);
    }
  },

  loadSheet: async (sheetId: number) => {
    const cellsData = await sheetsApi.getCells(sheetId);
    const cellsMap = new Map<string, CellData>();
    for (const c of cellsData) {
      cellsMap.set(cellKey(c.row, c.col), c);
    }

    const sheet = get().sheets.find((s) => s.id === sheetId);
    const hf = get().hf || initHyperFormula();
    const computed = computeFormulas(hf, cellsMap, sheet?.row_count || 100, sheet?.col_count || 26);

    set({
      activeSheetId: sheetId,
      cells: computed,
      selectedCell: { row: 0, col: 0 },
      selectedRange: null,
      isEditing: false,
      undoStack: [],
      redoStack: [],
      isDirty: false,
    });
  },

  setActiveSheet: (sheetId: number) => {
    const state = get();
    if (state.isDirty) {
      state.saveCells();
    }
    state.loadSheet(sheetId);
  },

  addSheet: async () => {
    const { workbook, sheets } = get();
    if (!workbook) return;
    const newSheet = await sheetsApi.create({
      workbook_id: workbook.id,
      name: `Sheet ${sheets.length + 1}`,
    });
    set({ sheets: [...sheets, newSheet] });
    await get().loadSheet(newSheet.id);
  },

  renameSheet: async (sheetId: number, name: string) => {
    await sheetsApi.update(sheetId, { name });
    set({
      sheets: get().sheets.map((s) => (s.id === sheetId ? { ...s, name } : s)),
    });
  },

  deleteSheet: async (sheetId: number) => {
    const { sheets, activeSheetId } = get();
    if (sheets.length <= 1) return;
    await sheetsApi.delete(sheetId);
    const remaining = sheets.filter((s) => s.id !== sheetId);
    set({ sheets: remaining });
    if (activeSheetId === sheetId) {
      await get().loadSheet(remaining[0].id);
    }
  },

  selectCell: (pos: CellPosition) => {
    set({
      selectedCell: pos,
      selectedRange: { start: pos, end: pos },
      isEditing: false,
    });
  },

  selectRange: (range: CellRange) => {
    set({ selectedRange: range });
  },

  startEditing: (value?: string) => {
    const cell = get().selectedCell;
    if (!cell) return;
    const existing = get().cells.get(cellKey(cell.row, cell.col));
    set({
      isEditing: true,
      editValue: value !== undefined ? value : (existing?.raw_value || ""),
    });
  },

  stopEditing: (save = true) => {
    if (!get().isEditing) return;
    if (save) {
      const cell = get().selectedCell;
      if (cell) {
        get().setCellValue(cell.row, cell.col, get().editValue);
      }
    }
    set({ isEditing: false, editValue: "" });
  },

  setEditValue: (value: string) => {
    set({ editValue: value });
  },

  setCellValue: (row: number, col: number, value: string) => {
    const { cells, hf, sheets, activeSheetId } = get();

    // Save for undo
    const undoSnapshot = new Map(cells);
    const undoStack = [...get().undoStack, undoSnapshot].slice(-50);

    const key = cellKey(row, col);
    const existing = cells.get(key);
    const newCell: CellData = {
      ...(DEFAULT_CELL as any),
      ...existing,
      row,
      col,
      raw_value: value,
    };

    // Determine type
    if (value.startsWith("=")) {
      newCell.data_type = "formula";
    } else if (value === "") {
      newCell.data_type = "string";
      newCell.computed_value = "";
    } else {
      const num = Number(value);
      if (!isNaN(num)) {
        newCell.data_type = "number";
        newCell.computed_value = value;
      } else {
        newCell.data_type = "string";
        newCell.computed_value = value;
      }
    }

    const newCells = new Map(cells);
    if (value === "" && !existing?.font_bold && !existing?.bg_color) {
      newCells.delete(key);
    } else {
      newCells.set(key, newCell);
    }

    // Recompute formulas
    const sheet = sheets.find((s) => s.id === activeSheetId);
    const computed = hf
      ? computeFormulas(hf, newCells, sheet?.row_count || 100, sheet?.col_count || 26)
      : newCells;

    set({ cells: computed, undoStack, redoStack: [], isDirty: true });
  },

  setCellFormat: (positions: CellPosition[], format: Partial<CellData>) => {
    const { cells } = get();
    const undoSnapshot = new Map(cells);
    const undoStack = [...get().undoStack, undoSnapshot].slice(-50);
    const newCells = new Map(cells);

    for (const pos of positions) {
      const key = cellKey(pos.row, pos.col);
      const existing = newCells.get(key) || {
        ...(DEFAULT_CELL as any),
        row: pos.row,
        col: pos.col,
      };
      newCells.set(key, { ...existing, ...format });
    }

    set({ cells: newCells, undoStack, redoStack: [], isDirty: true });
  },

  clearCells: (positions: CellPosition[]) => {
    const { cells } = get();
    const undoSnapshot = new Map(cells);
    const undoStack = [...get().undoStack, undoSnapshot].slice(-50);
    const newCells = new Map(cells);

    for (const pos of positions) {
      newCells.delete(cellKey(pos.row, pos.col));
    }

    set({ cells: newCells, undoStack, redoStack: [], isDirty: true });
  },

  copyCells: () => {
    const { selectedRange, cells } = get();
    if (!selectedRange) return;

    const copied: CellData[] = [];
    const minR = Math.min(selectedRange.start.row, selectedRange.end.row);
    const maxR = Math.max(selectedRange.start.row, selectedRange.end.row);
    const minC = Math.min(selectedRange.start.col, selectedRange.end.col);
    const maxC = Math.max(selectedRange.start.col, selectedRange.end.col);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = cells.get(cellKey(r, c));
        if (cell) copied.push({ ...cell });
      }
    }

    set({ clipboard: copied, clipboardRange: selectedRange });
  },

  pasteCells: () => {
    const { clipboard, clipboardRange, selectedCell } = get();
    if (!clipboard || !clipboardRange || !selectedCell) return;

    const offsetR = selectedCell.row - Math.min(clipboardRange.start.row, clipboardRange.end.row);
    const offsetC = selectedCell.col - Math.min(clipboardRange.start.col, clipboardRange.end.col);

    for (const cell of clipboard) {
      get().setCellValue(cell.row + offsetR, cell.col + offsetC, cell.raw_value);
    }
  },

  undo: () => {
    const { undoStack, cells } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    const redoStack = [...get().redoStack, new Map(cells)].slice(-50);
    set({
      cells: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack,
      isDirty: true,
    });
  },

  redo: () => {
    const { redoStack, cells } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const undoStack = [...get().undoStack, new Map(cells)].slice(-50);
    set({
      cells: next,
      redoStack: redoStack.slice(0, -1),
      undoStack,
      isDirty: true,
    });
  },

  saveCells: async () => {
    const { activeSheetId, cells, isSaving } = get();
    if (!activeSheetId || isSaving) return;

    set({ isSaving: true });
    try {
      const cellsArr = Array.from(cells.values()).map((c) => ({
        row: c.row,
        col: c.col,
        raw_value: c.raw_value,
        computed_value: c.computed_value,
        data_type: c.data_type,
        format_type: c.format_type,
        decimal_places: c.decimal_places,
        font_bold: c.font_bold,
        font_italic: c.font_italic,
        font_size: c.font_size,
        font_color: c.font_color,
        bg_color: c.bg_color,
        text_align: c.text_align,
        border: c.border,
      }));
      await sheetsApi.updateCells(activeSheetId, cellsArr);
      set({ isDirty: false, lastSaved: new Date() });
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      set({ isSaving: false });
    }
  },
}));
