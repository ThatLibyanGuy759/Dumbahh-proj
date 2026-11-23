import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { saveAs } from "file-saver";
import { workbooksApi } from "@/lib/api";
import { useAssignmentScope } from "@/lib/assignmentScope";

/**
 * Get the generated accounting workbook for the current scope. If one already exists the user
 * chooses between regenerating it from the latest entries (replacing in-app edits) or keeping it.
 */
async function getOrGenerateWorkbook(assignmentId?: number) {
  try {
    return await workbooksApi.generateAccounting(assignmentId ?? null, false);
  } catch (err: any) {
    if (err.status !== 409) throw err;
    const regenerate = confirm(
      "An accounting workbook already exists for this project.\n\n" +
        "OK = Regenerate it from the current accounts and journal entries (replaces any edits made in the spreadsheet)\n" +
        "Cancel = Use the existing workbook (keeps your edits)"
    );
    return regenerate ? await workbooksApi.generateAccounting(assignmentId ?? null, true) : err.existing;
  }
}

export default function WorkbookActions({ sheet, className = "" }: { sheet?: string; className?: string }) {
  const { assignmentId } = useAssignmentScope();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"open" | "download" | null>(null);

  const handleOpen = async () => {
    setBusy("open");
    try {
      const wb = await getOrGenerateWorkbook(assignmentId);
      navigate(`/workbook/${wb.id}${sheet ? `?sheet=${encodeURIComponent(sheet)}` : ""}`);
    } catch (err: any) {
      alert(err.message || "Failed to generate workbook");
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    setBusy("download");
    try {
      const wb = await getOrGenerateWorkbook(assignmentId);
      const res = await fetch(workbooksApi.exportUrl(wb.id));
      if (!res.ok) throw new Error(res.statusText);
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      saveAs(await res.blob(), match ? decodeURIComponent(match[1]) : "Accounting Statements.xlsx");
    } catch (err: any) {
      alert(err.message || "Failed to download workbook");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleOpen}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-60"
        title="Open the formatted General Journal, Ledger, Trial Balance and Statements as an editable spreadsheet"
      >
        {busy === "open" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        Open as Spreadsheet
      </button>
      <button
        onClick={handleDownload}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-60"
        title="Download all five sheets as a formatted Excel workbook (.xlsx)"
      >
        {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Download Excel
      </button>
    </div>
  );
}
