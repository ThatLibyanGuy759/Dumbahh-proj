import React, { useState, useEffect } from "react";
import WorkbookActions from "@/components/WorkbookActions";
import { useAssignmentScope, AssignmentScopeBanner } from "@/lib/assignmentScope";
import { Scale, CheckCircle2, AlertTriangle, Printer, Download, RefreshCw, Filter } from "lucide-react";
import { reportsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { TrialBalanceData } from "@/types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function TrialBalancePage() {
  const { assignmentId, assignment, withScope } = useAssignmentScope();
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("Mr. Scarpelli's Electronic Repair Services");
  const [asOfDate, setAsOfDate] = useState("June 30, 2025");
  const [hideUnused, setHideUnused] = useState(true);

  const loadTrialBalance = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.generateTrialBalance(assignmentId, hideUnused);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrialBalance();
  }, [hideUnused, assignmentId]);

  // Default the company name to the assignment's name when scoped
  useEffect(() => {
    if (assignment?.name) setCompanyName(assignment.name);
  }, [assignment?.name]);

  const handleExportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(companyName, 105, 15, { align: "center" });
    doc.setFontSize(13);
    doc.text("Trial Balance", 105, 22, { align: "center" });
    doc.setFontSize(10);
    doc.text(`As of ${asOfDate}`, 105, 28, { align: "center" });

    const tableRows = data.accounts.map((acc) => [
      acc.account_code,
      acc.account_name,
      acc.debit > 0 ? formatCurrency(acc.debit) : "",
      acc.credit > 0 ? formatCurrency(acc.credit) : "",
    ]);

    tableRows.push([
      "Total",
      "",
      formatCurrency(data.total_debits),
      formatCurrency(data.total_credits),
    ]);

    autoTable(doc, {
      startY: 35,
      head: [["Account #", "Account Title", "Debit ($)", "Credit ($)"]],
      body: tableRows,
      theme: "striped",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`${companyName.replace(/\s+/g, "_")}_Trial_Balance.pdf`);
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <AssignmentScopeBanner />
      <div className="flex justify-end">
        <WorkbookActions sheet={"Trial Balance"} />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="h-6 w-6 text-blue-600" />
            Trial Balance Generator
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Summary of all general ledger account balances and verification that Total Debits = Total Credits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTrialBalance}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
          >
            <Download className="h-4 w-4" /> Export PDF
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {/* Report Customizer & Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Company / Entity Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full text-xs px-3 py-1.5 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">As Of Date</label>
          <input
            type="text"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-full text-xs px-3 py-1.5 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="pt-4">
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={hideUnused}
              onChange={(e) => setHideUnused(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Exclude unused accounts (zero balance & no activity)</span>
          </label>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-6">
        {/* Professional Header */}
        <div className="text-center space-y-1 border-b pb-4">
          <h2 className="text-lg font-bold text-gray-900 tracking-wide uppercase font-serif">{companyName}</h2>
          <h3 className="text-base font-semibold text-blue-700">Trial Balance</h3>
          <p className="text-xs text-gray-500">As of {asOfDate}</p>
        </div>

        {/* Balance Status Banner */}
        {data && (
          <div
            className={`flex items-center justify-between p-3.5 rounded-lg text-xs font-semibold ${
              data.is_balanced
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {data.is_balanced ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Balanced! Total Debits equal Total Credits (${data.total_debits.toLocaleString()}).</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>
                    Out of balance! Difference: {formatCurrency(Math.abs(data.total_debits - data.total_credits))}
                  </span>
                </>
              )}
            </div>
            <span className="font-mono">
              Debits: {formatCurrency(data.total_debits)} | Credits: {formatCurrency(data.total_credits)}
            </span>
          </div>
        )}

        {/* Table */}
        {!data || data.accounts.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No accounts or transactions found to generate trial balance.
          </div>
        ) : (
          <table className="min-w-full text-xs border border-gray-300">
            <thead className="bg-gray-100 border-b border-gray-300">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-300 w-24">
                  Account #
                </th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-300">
                  Account Title
                </th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-700 border-r border-gray-300 w-36">
                  Debit ($)
                </th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-700 w-36">
                  Credit ($)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.accounts.map((acc, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2 font-mono font-bold text-gray-600 border-r border-gray-200">
                    {acc.account_code}
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-800 border-r border-gray-200">
                    {acc.account_name}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-gray-900 border-r border-gray-200">
                    {acc.debit > 0 ? formatCurrency(acc.debit) : ""}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-gray-900">
                    {acc.credit > 0 ? formatCurrency(acc.credit) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-400 font-bold text-gray-900">
              <tr>
                <td colSpan={2} className="px-4 py-2.5 text-right border-r border-gray-300">
                  Total
                </td>
                <td className="px-4 py-2.5 text-right font-mono border-r border-gray-300 border-b-4 border-double border-gray-800">
                  {formatCurrency(data.total_debits)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono border-b-4 border-double border-gray-800">
                  {formatCurrency(data.total_credits)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
