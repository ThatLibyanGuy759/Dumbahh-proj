import React, { useState } from "react";
import { Plus, X, Pencil, MoreVertical } from "lucide-react";
import { useSpreadsheetStore } from "@/stores/spreadsheetStore";

export default function SheetTabs() {
  const sheets = useSpreadsheetStore((s) => s.sheets);
  const activeSheetId = useSpreadsheetStore((s) => s.activeSheetId);
  const setActiveSheet = useSpreadsheetStore((s) => s.setActiveSheet);
  const addSheet = useSpreadsheetStore((s) => s.addSheet);
  const renameSheet = useSpreadsheetStore((s) => s.renameSheet);
  const deleteSheet = useSpreadsheetStore((s) => s.deleteSheet);

  const [editingSheetId, setEditingSheetId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const startRename = (id: number, currentName: string) => {
    setEditingSheetId(id);
    setEditingName(currentName);
  };

  const handleFinishRename = (id: number) => {
    if (editingName.trim()) {
      renameSheet(id, editingName.trim());
    }
    setEditingSheetId(null);
  };

  return (
    <div className="flex items-center border-t border-gray-200 bg-gray-100 px-2 py-1 gap-1 text-xs select-none">
      <button
        onClick={() => addSheet()}
        className="p-1 rounded hover:bg-gray-200 text-gray-600 transition"
        title="Add new sheet"
      >
        <Plus className="h-4 w-4" />
      </button>

      <div className="h-4 w-[1px] bg-gray-300 mx-1" />

      <div className="flex items-center gap-1 overflow-x-auto py-0.5">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId;
          const isRenaming = editingSheetId === sheet.id;

          return (
            <div
              key={sheet.id}
              onClick={() => !isRenaming && setActiveSheet(sheet.id)}
              onDoubleClick={() => startRename(sheet.id, sheet.name)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-md cursor-pointer border-t-2 transition text-xs font-medium ${
                isActive
                  ? "bg-white border-blue-600 text-blue-700 shadow-2xs"
                  : "bg-gray-200/80 border-transparent text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isRenaming ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleFinishRename(sheet.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleFinishRename(sheet.id);
                    if (e.key === "Escape") setEditingSheetId(null);
                  }}
                  autoFocus
                  className="bg-white px-1 py-0.5 border border-blue-400 rounded outline-none text-xs w-24"
                />
              ) : (
                <span>{sheet.name}</span>
              )}

              {sheets.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete sheet "${sheet.name}"?`)) {
                      deleteSheet(sheet.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 rounded p-0.5"
                  title="Delete sheet"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
