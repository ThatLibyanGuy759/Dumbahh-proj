import React, { useEffect, useState } from "react";
import { cellRef } from "@/lib/utils";
import { useSpreadsheetStore } from "@/stores/spreadsheetStore";

export default function FormulaBar() {
  const selectedCell = useSpreadsheetStore((s) => s.selectedCell);
  const cells = useSpreadsheetStore((s) => s.cells);
  const setCellValue = useSpreadsheetStore((s) => s.setCellValue);
  const editValue = useSpreadsheetStore((s) => s.editValue);
  const isEditing = useSpreadsheetStore((s) => s.isEditing);
  const setEditValue = useSpreadsheetStore((s) => s.setEditValue);

  const [inputVal, setInputVal] = useState("");

  const currentRef = selectedCell ? cellRef(selectedCell.row, selectedCell.col) : "A1";

  useEffect(() => {
    if (selectedCell) {
      if (isEditing) {
        setInputVal(editValue);
      } else {
        const cell = cells.get(`${selectedCell.row},${selectedCell.col}`);
        setInputVal(cell?.raw_value || "");
      }
    } else {
      setInputVal("");
    }
  }, [selectedCell, cells, isEditing, editValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);
    if (isEditing) {
      setEditValue(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && selectedCell) {
      setCellValue(selectedCell.row, selectedCell.col, inputVal);
      e.currentTarget.blur();
    } else if (e.key === "Escape" && selectedCell) {
      const cell = cells.get(`${selectedCell.row},${selectedCell.col}`);
      setInputVal(cell?.raw_value || "");
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50/50 text-xs text-gray-700">
      {/* Cell Reference Box */}
      <div className="w-14 px-2 py-1 font-mono font-semibold text-center bg-white border border-gray-300 rounded shadow-2xs">
        {currentRef}
      </div>

      {/* Function indicator fx */}
      <div className="font-serif italic font-bold text-gray-400 select-none px-1">
        fx
      </div>

      {/* Formula Input */}
      <input
        type="text"
        value={inputVal}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Enter value or formula (e.g. =SUM(A1:A5), =AVERAGE(B1:B10))"
        className="flex-1 px-2.5 py-1 bg-white border border-gray-300 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
