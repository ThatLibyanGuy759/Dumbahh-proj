import React from "react";
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  DollarSign,
  Percent,
  Hash,
  Undo2,
  Redo2,
  Save,
  Download,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import { useSpreadsheetStore } from "@/stores/spreadsheetStore";
import * as XLSX from "xlsx";

export default function Toolbar() {
  const selectedCell = useSpreadsheetStore((s) => s.selectedCell);
  const selectedRange = useSpreadsheetStore((s) => s.selectedRange);
  const setCellFormat = useSpreadsheetStore((s) => s.setCellFormat);
  const undo = useSpreadsheetStore((s) => s.undo);
  const redo = useSpreadsheetStore((s) => s.redo);
  const saveCells = useSpreadsheetStore((s) => s.saveCells);
  const isSaving = useSpreadsheetStore((s) => s.isSaving);
  const isDirty = useSpreadsheetStore((s) => s.isDirty);
  const cells = useSpreadsheetStore((s) => s.cells);
  const setCellValue = useSpreadsheetStore((s) => s.setCellValue);
  const workbook = useSpreadsheetStore((s) => s.workbook);

  // Get current cell formatting
  const currentCell = selectedCell
    ? cells.get(`${selectedCell.row},${selectedCell.col}`)
    : null;

  const getTargetPositions = () => {
    if (!selectedRange) {
      return selectedCell ? [selectedCell] : [];
    }
    const positions = [];
    const minR = Math.min(selectedRange.start.row, selectedRange.end.row);
    const maxR = Math.max(selectedRange.start.row, selectedRange.end.row);
    const minC = Math.min(selectedRange.start.col, selectedRange.end.col);
    const maxC = Math.max(selectedRange.start.col, selectedRange.end.col);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        positions.push({ row: r, col: c });
      }
    }
    return positions;
  };

  const handleToggleBold = () => {
    const targets = getTargetPositions();
    if (targets.length === 0) return;
    const isBold = !currentCell?.font_bold;
    setCellFormat(targets, { font_bold: isBold });
  };

  const handleToggleItalic = () => {
    const targets = getTargetPositions();
    if (targets.length === 0) return;
    const isItalic = !currentCell?.font_italic;
    setCellFormat(targets, { font_italic: isItalic });
  };

  const handleAlign = (align: "left" | "center" | "right") => {
    const targets = getTargetPositions();
    if (targets.length === 0) return;
    setCellFormat(targets, { text_align: align });
  };

  const handleFormatType = (type: "general" | "currency" | "percentage" | "number") => {
    const targets = getTargetPositions();
    if (targets.length === 0) return;
    setCellFormat(targets, { format_type: type });
  };

  const handleBgColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targets = getTargetPositions();
    if (targets.length === 0) return;
    setCellFormat(targets, { bg_color: e.target.value });
  };

  const handleTextColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targets = getTargetPositions();
    if (targets.length === 0) return;
    setCellFormat(targets, { font_color: e.target.value });
  };

  const handleExportXLSX = () => {
    const data: (string | number)[][] = [];
    for (let r = 0; r < 50; r++) {
      const row: (string | number)[] = [];
      for (let c = 0; c < 26; c++) {
        const cell = cells.get(`${r},${c}`);
        row.push(cell ? (cell.computed_value || cell.raw_value) : "");
      }
      data.push(row);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${workbook?.name || "LedgerLab_Spreadsheet"}.xlsx`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const json: (string | number)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        json.forEach((row, r) => {
          row.forEach((val, c) => {
            if (val !== undefined && val !== null) {
              setCellValue(r, c, String(val));
            }
          });
        });
      } catch (err) {
        alert("Failed to parse spreadsheet file");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-gray-200 bg-white select-none text-xs text-gray-700">
      {/* Undo / Redo */}
      <button
        onClick={undo}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        onClick={redo}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="h-4 w-4" />
      </button>

      <div className="h-4 w-[1px] bg-gray-300 mx-1" />

      {/* Formatting: Bold / Italic */}
      <button
        onClick={handleToggleBold}
        className={`p-1.5 rounded hover:bg-gray-100 ${
          currentCell?.font_bold ? "bg-gray-200 font-bold text-blue-700" : "text-gray-600"
        }`}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        onClick={handleToggleItalic}
        className={`p-1.5 rounded hover:bg-gray-100 ${
          currentCell?.font_italic ? "bg-gray-200 italic text-blue-700" : "text-gray-600"
        }`}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </button>

      <div className="h-4 w-[1px] bg-gray-300 mx-1" />

      {/* Alignment */}
      <button
        onClick={() => handleAlign("left")}
        className={`p-1.5 rounded hover:bg-gray-100 ${
          currentCell?.text_align === "left" ? "bg-gray-200 text-blue-700" : "text-gray-600"
        }`}
        title="Align Left"
      >
        <AlignLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => handleAlign("center")}
        className={`p-1.5 rounded hover:bg-gray-100 ${
          currentCell?.text_align === "center" ? "bg-gray-200 text-blue-700" : "text-gray-600"
        }`}
        title="Align Center"
      >
        <AlignCenter className="h-4 w-4" />
      </button>
      <button
        onClick={() => handleAlign("right")}
        className={`p-1.5 rounded hover:bg-gray-100 ${
          currentCell?.text_align === "right" ? "bg-gray-200 text-blue-700" : "text-gray-600"
        }`}
        title="Align Right"
      >
        <AlignRight className="h-4 w-4" />
      </button>

      <div className="h-4 w-[1px] bg-gray-300 mx-1" />

      {/* Accounting / Number format shortcuts */}
      <button
        onClick={() => handleFormatType("currency")}
        className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 ${
          currentCell?.format_type === "currency" ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600"
        }`}
        title="Format as Currency ($)"
      >
        <DollarSign className="h-3.5 w-3.5" /> Currency
      </button>
      <button
        onClick={() => handleFormatType("percentage")}
        className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 ${
          currentCell?.format_type === "percentage" ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600"
        }`}
        title="Format as Percentage (%)"
      >
        <Percent className="h-3.5 w-3.5" /> Percent
      </button>
      <button
        onClick={() => handleFormatType("number")}
        className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 ${
          currentCell?.format_type === "number" ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600"
        }`}
        title="Format as Number"
      >
        <Hash className="h-3.5 w-3.5" /> Number
      </button>

      <div className="h-4 w-[1px] bg-gray-300 mx-1" />

      {/* Colors */}
      <label className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 cursor-pointer" title="Background Color">
        <span className="w-3.5 h-3.5 rounded border border-gray-400 inline-block" style={{ backgroundColor: currentCell?.bg_color || "#ffffff" }} />
        <span className="text-[11px] text-gray-500">Fill</span>
        <input type="color" className="sr-only" onChange={handleBgColor} value={currentCell?.bg_color || "#ffffff"} />
      </label>

      <label className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 cursor-pointer" title="Text Color">
        <span className="w-3.5 h-3.5 rounded border border-gray-400 font-bold flex items-center justify-center text-[10px]" style={{ color: currentCell?.font_color || "#000000" }}>A</span>
        <span className="text-[11px] text-gray-500">Color</span>
        <input type="color" className="sr-only" onChange={handleTextColor} value={currentCell?.font_color || "#000000"} />
      </label>

      <div className="h-4 w-[1px] bg-gray-300 mx-1" />

      {/* Import / Export */}
      <label className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 cursor-pointer text-gray-600">
        <Upload className="h-3.5 w-3.5" />
        <span>Import</span>
        <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={handleImportFile} />
      </label>

      <button
        onClick={handleExportXLSX}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-gray-600"
        title="Export to Excel (.xlsx)"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Export</span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => saveCells()}
          disabled={isSaving || !isDirty}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
            isDirty
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              : "bg-gray-100 text-gray-400 cursor-default"
          }`}
        >
          <Save className="h-3.5 w-3.5" />
          <span>{isSaving ? "Saving..." : isDirty ? "Save Changes" : "Saved"}</span>
        </button>
      </div>
    </div>
  );
}
