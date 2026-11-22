import React, { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { useSpreadsheetStore } from "@/stores/spreadsheetStore";
import Toolbar from "@/components/spreadsheet/Toolbar";
import FormulaBar from "@/components/spreadsheet/FormulaBar";
import SpreadsheetGrid from "@/components/spreadsheet/SpreadsheetGrid";
import SheetTabs from "@/components/spreadsheet/SheetTabs";

export default function WorkbookPage() {
  const { id } = useParams<{ id: string }>();
  const loadWorkbook = useSpreadsheetStore((s) => s.loadWorkbook);
  const workbook = useSpreadsheetStore((s) => s.workbook);
  const saveCells = useSpreadsheetStore((s) => s.saveCells);
  const isDirty = useSpreadsheetStore((s) => s.isDirty);

  useEffect(() => {
    if (id) {
      loadWorkbook(Number(id));
    }
  }, [id, loadWorkbook]);

  // Periodic Auto-save every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty) {
        saveCells();
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [isDirty, saveCells]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-white overflow-hidden">
      {/* Workbook Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            <h1 className="text-sm font-semibold text-gray-900">
              {workbook?.name || "Spreadsheet Workspace"}
            </h1>
          </div>
        </div>
      </div>

      {/* Spreadsheet Toolbar */}
      <Toolbar />

      {/* Formula Bar */}
      <FormulaBar />

      {/* Spreadsheet Grid */}
      <SpreadsheetGrid />

      {/* Sheet Tabs */}
      <SheetTabs />
    </div>
  );
}
