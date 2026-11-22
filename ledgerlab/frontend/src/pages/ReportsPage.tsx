import React, { useState, useEffect } from "react";
import {
  FileBarChart,
  Printer,
  Download,
  Building,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { reportsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { IncomeStatementData, BalanceSheetData } from "@/types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"income_statement" | "balance_sheet">("income_statement");
  const [companyName, setCompanyName] = useState("Mr. Scarpelli's Electronic Repair Services");
  const [reportingPeriod, setReportingPeriod] = useState("For the Month Ended June 30, 2025");
  const [hideUnused, setHideUnused] = useState(true);

  const [incomeData, setIncomeData] = useState<any>(null);
  const [balanceData, setBalanceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const is = await reportsApi.generateIncomeStatement(undefined, hideUnused);
      setIncomeData(is);
      const bs = await reportsApi.generateBalanceSheet(undefined, hideUnused);
      setBalanceData(bs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [hideUnused]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(companyName, 105, 15, { align: "center" });
    doc.setFontSize(13);
    const title = activeTab === "income_statement" ? "Income Statement" : "Balance Sheet";
    doc.text(title, 105, 22, { align: "center" });
    doc.setFontSize(10);
    doc.text(reportingPeriod, 105, 28, { align: "center" });

    if (activeTab === "income_statement" && incomeData) {
      const rows: any[] = [];
      rows.push([{ content: "REVENUES", colSpan: 2, styles: { fontStyle: "bold" } }]);
      incomeData.revenues.forEach((r: any) => rows.push([r.account_name, formatCurrency(r.amount)]));
      rows.push([{ content: "Total Revenues", styles: { fontStyle: "bold" } }, formatCurrency(incomeData.total_revenue)]);

      rows.push([{ content: "OPERATING EXPENSES", colSpan: 2, styles: { fontStyle: "bold" } }]);
      incomeData.expenses.forEach((e: any) => rows.push([e.account_name, formatCurrency(e.amount)]));
      rows.push([{ content: "Total Expenses", styles: { fontStyle: "bold" } }, formatCurrency(incomeData.total_expenses)]);
      rows.push([{ content: "NET INCOME", styles: { fontStyle: "bold" } }, formatCurrency(incomeData.net_income)]);

      autoTable(doc, {
        startY: 35,
        head: [["Account Title", "Amount ($)"]],
        body: rows,
        theme: "plain",
      });
    } else if (activeTab === "balance_sheet" && balanceData) {
      const rows: any[] = [];
      rows.push([{ content: "ASSETS", colSpan: 2, styles: { fontStyle: "bold" } }]);
      balanceData.assets.forEach((a: any) => rows.push([a.account_name, formatCurrency(a.amount)]));
      rows.push([{ content: "Total Assets", styles: { fontStyle: "bold" } }, formatCurrency(balanceData.total_assets)]);

      rows.push([{ content: "LIABILITIES", colSpan: 2, styles: { fontStyle: "bold" } }]);
      balanceData.liabilities.forEach((l: any) => rows.push([l.account_name, formatCurrency(l.amount)]));
      rows.push([{ content: "Total Liabilities", styles: { fontStyle: "bold" } }, formatCurrency(balanceData.total_liabilities)]);

      rows.push([{ content: "OWNER'S EQUITY", colSpan: 2, styles: { fontStyle: "bold" } }]);
      rows.push(["Beginning Capital", formatCurrency(balanceData.beginning_capital)]);
      rows.push(["Add: Net Income", formatCurrency(balanceData.net_income)]);
      if (balanceData.drawings > 0) {
        rows.push(["Less: Drawings", `(${formatCurrency(balanceData.drawings)})`]);
      }
      rows.push([{ content: "Ending Owner's Equity", styles: { fontStyle: "bold" } }, formatCurrency(balanceData.ending_capital)]);
      rows.push([{ content: "Total Liabilities and Owner's Equity", styles: { fontStyle: "bold" } }, formatCurrency(balanceData.total_liabilities_and_equity)]);

      autoTable(doc, {
        startY: 35,
        head: [["Account Title", "Amount ($)"]],
        body: rows,
        theme: "plain",
      });
    }

    doc.save(`${companyName.replace(/\s+/g, "_")}_${activeTab}.pdf`);
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-blue-600" />
            Financial Statement Builder
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Polished, publication-ready Income Statement and Balance Sheet generated from recorded transactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
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
            <Printer className="h-4 w-4" /> Print Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("income_statement")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeTab === "income_statement"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Income Statement
        </button>
        <button
          onClick={() => setActiveTab("balance_sheet")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeTab === "balance_sheet"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Balance Sheet
        </button>
      </div>

      {/* Report Options Form */}
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
          <label className="block text-xs font-medium text-gray-700 mb-1">Reporting Period</label>
          <input
            type="text"
            value={reportingPeriod}
            onChange={(e) => setReportingPeriod(e.target.value)}
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
            <span>Exclude unused accounts</span>
          </label>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 space-y-8 font-serif">
        {/* Document Header */}
        <div className="text-center space-y-1 border-b border-gray-300 pb-5 font-sans">
          <h2 className="text-xl font-bold tracking-wide uppercase text-gray-900">{companyName}</h2>
          <h3 className="text-lg font-semibold text-blue-700">
            {activeTab === "income_statement" ? "Income Statement" : "Balance Sheet"}
          </h3>
          <p className="text-xs text-gray-500 italic">{reportingPeriod}</p>
        </div>

        {/* Balance Sheet Verification Banner */}
        {activeTab === "balance_sheet" && balanceData && (
          <div
            className={`flex items-center justify-between p-3.5 rounded-lg text-xs font-sans font-semibold ${
              balanceData.is_balanced
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {balanceData.is_balanced ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>The Balance Sheet balances! Total Assets equal Total Liabilities and Owner's Equity.</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>Out of balance by {formatCurrency(balanceData.difference)}!</span>
                </>
              )}
            </div>
            <span className="font-mono">
              Assets: {formatCurrency(balanceData.total_assets)} | L+E: {formatCurrency(balanceData.total_liabilities_and_equity)}
            </span>
          </div>
        )}

        {/* Content: Income Statement */}
        {activeTab === "income_statement" && (
          <div className="space-y-6 max-w-2xl mx-auto text-sm">
            {/* Revenues */}
            <div>
              <h4 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider border-b border-gray-300 pb-1">
                Revenues
              </h4>
              <div className="mt-2 space-y-1">
                {incomeData?.revenues.length === 0 ? (
                  <p className="text-xs text-gray-400 italic pl-4">No revenues recorded.</p>
                ) : (
                  incomeData?.revenues.map((rev: any, idx: number) => (
                    <div key={idx} className="flex justify-between pl-4 text-gray-800">
                      <span>{rev.account_name}</span>
                      <span className="font-mono">{formatCurrency(rev.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between font-bold pt-2 border-t border-gray-300 font-sans">
                  <span>Total Revenues</span>
                  <span className="font-mono">{formatCurrency(incomeData?.total_revenue || 0)}</span>
                </div>
              </div>
            </div>

            {/* Operating Expenses */}
            <div>
              <h4 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider border-b border-gray-300 pb-1">
                Operating Expenses
              </h4>
              <div className="mt-2 space-y-1">
                {incomeData?.expenses.length === 0 ? (
                  <p className="text-xs text-gray-400 italic pl-4">No expenses recorded.</p>
                ) : (
                  incomeData?.expenses.map((exp: any, idx: number) => (
                    <div key={idx} className="flex justify-between pl-4 text-gray-800">
                      <span>{exp.account_name}</span>
                      <span className="font-mono">{formatCurrency(exp.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between font-bold pt-2 border-t border-gray-300 font-sans">
                  <span>Total Operating Expenses</span>
                  <span className="font-mono">{formatCurrency(incomeData?.total_expenses || 0)}</span>
                </div>
              </div>
            </div>

            {/* Net Income */}
            <div className="pt-4 border-t-2 border-gray-400">
              <div className="flex justify-between items-center text-base font-bold text-blue-900 font-sans border-b-4 border-double border-gray-900 pb-1">
                <span>Net Income (Loss)</span>
                <span className="font-mono">{formatCurrency(incomeData?.net_income || 0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Content: Balance Sheet */}
        {activeTab === "balance_sheet" && (
          <div className="space-y-6 max-w-2xl mx-auto text-sm">
            {/* Assets */}
            <div>
              <h4 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider border-b border-gray-300 pb-1">
                Assets
              </h4>
              <div className="mt-2 space-y-1">
                {balanceData?.assets.map((ast: any, idx: number) => (
                  <div key={idx} className="flex justify-between pl-4 text-gray-800">
                    <span>{ast.account_name}</span>
                    <span className="font-mono">{formatCurrency(ast.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2 border-t border-gray-300 font-sans border-b-4 border-double border-gray-900 pb-1">
                  <span>Total Assets</span>
                  <span className="font-mono">{formatCurrency(balanceData?.total_assets || 0)}</span>
                </div>
              </div>
            </div>

            {/* Liabilities */}
            <div>
              <h4 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider border-b border-gray-300 pb-1">
                Liabilities
              </h4>
              <div className="mt-2 space-y-1">
                {balanceData?.liabilities.map((lia: any, idx: number) => (
                  <div key={idx} className="flex justify-between pl-4 text-gray-800">
                    <span>{lia.account_name}</span>
                    <span className="font-mono">{formatCurrency(lia.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2 border-t border-gray-300 font-sans">
                  <span>Total Liabilities</span>
                  <span className="font-mono">{formatCurrency(balanceData?.total_liabilities || 0)}</span>
                </div>
              </div>
            </div>

            {/* Owner's Equity */}
            <div>
              <h4 className="font-sans font-bold text-gray-900 uppercase text-xs tracking-wider border-b border-gray-300 pb-1">
                Owner's Equity
              </h4>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between pl-4 text-gray-800">
                  <span>Beginning Capital</span>
                  <span className="font-mono">{formatCurrency(balanceData?.beginning_capital || 0)}</span>
                </div>
                <div className="flex justify-between pl-4 text-gray-800">
                  <span>Add: Net Income for the Period</span>
                  <span className="font-mono">{formatCurrency(balanceData?.net_income || 0)}</span>
                </div>
                {balanceData?.drawings > 0 && (
                  <div className="flex justify-between pl-4 text-gray-800">
                    <span>Less: Drawings</span>
                    <span className="font-mono">({formatCurrency(balanceData.drawings)})</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-2 border-t border-gray-300 font-sans">
                  <span>Ending Owner's Equity</span>
                  <span className="font-mono">{formatCurrency(balanceData?.ending_capital || 0)}</span>
                </div>
              </div>
            </div>

            {/* Total Liabilities & Owner's Equity */}
            <div className="pt-2">
              <div className="flex justify-between items-center text-sm font-bold text-gray-900 font-sans border-t-2 border-gray-400 border-b-4 border-double border-gray-900 py-1">
                <span>Total Liabilities and Owner's Equity</span>
                <span className="font-mono">
                  {formatCurrency(balanceData?.total_liabilities_and_equity || 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
