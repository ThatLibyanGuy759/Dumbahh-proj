import React, { useState, useEffect } from "react";
import { BookOpen, Search, Download, Printer, Layers, Eye } from "lucide-react";
import { getAccounts, getAccountLedger, getAllLedgers } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Account, LedgerData } from "@/types";

export default function LedgerPage() {
  const [viewMode, setViewMode] = useState<"all" | "single">("all");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [singleLedger, setSingleLedger] = useState<any>(null);
  const [allLedgers, setAllLedgers] = useState<any[]>([]);
  const [hideUnused, setHideUnused] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function init() {
      const accs = await getAccounts();
      setAccounts(accs);
      if (accs.length > 0) {
        setSelectedAccountId(accs[0].id);
      }
    }
    init();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (viewMode === "all") {
        const data = await getAllLedgers(undefined, hideUnused);
        setAllLedgers(data);
      } else if (selectedAccountId) {
        const data = await getAccountLedger(selectedAccountId);
        setSingleLedger(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [viewMode, selectedAccountId, hideUnused]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            General Ledger
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Official ledger showing beginning balances, chronological debit/credit postings, and running balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border text-xs">
            <button
              onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${viewMode === "all" ? "bg-white text-blue-700 shadow-2xs" : "text-gray-600"
                }`}
            >
              All T-Accounts ({allLedgers.length})
            </button>
            <button
              onClick={() => setViewMode("single")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${viewMode === "single" ? "bg-white text-blue-700 shadow-2xs" : "text-gray-600"
                }`}
            >
              Single Account
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
          >
            <Printer className="h-4 w-4" /> Print Ledger
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        {viewMode === "single" ? (
          <div className="flex items-center gap-3 flex-1">
            <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">
              Select Account:
            </label>
            <select
              value={selectedAccountId || ""}
              onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              className="flex-1 max-w-md border border-gray-300 rounded-md px-3 py-1.5 text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} – {acc.name} ({acc.account_type.toUpperCase()} / Normal: {acc.normal_balance})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-xs text-gray-600 font-medium">
            Displaying complete General Ledger for submission and review.
          </div>
        )}

        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={hideUnused}
            onChange={(e) => setHideUnused(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Exclude accounts with zero balance & no activity</span>
        </label>
      </div>

      {/* VIEW: All Accounts */}
      {viewMode === "all" && (
        <div className="space-y-6">
          {loading ? (
            <div className="bg-white p-12 text-center text-gray-400 text-xs rounded-xl border">
              Loading all general ledger accounts...
            </div>
          ) : allLedgers.length === 0 ? (
            <div className="bg-white p-12 text-center text-gray-400 text-sm rounded-xl border">
              No ledger activity recorded yet. Feed transactions in the Transaction Feeder.
            </div>
          ) : (
            allLedgers.map((accData) => {
              const acc = accData.account;
              return (
                <div
                  key={acc.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden break-inside-avoid"
                >
                  <div className="px-6 py-3 border-b border-gray-200 bg-gray-50/70 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {acc.code}
                        </span>
                        {acc.name}
                      </h3>
                      <p className="text-[11px] text-gray-500 capitalize">
                        Classification: {acc.account_type} | Normal Balance: {acc.normal_balance}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-gray-500 block">Ending Balance</span>
                      <span className="text-sm font-bold font-mono text-blue-700">
                        {formatCurrency(accData.ending_balance)}
                      </span>
                    </div>
                  </div>

                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600 w-28">Date</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600 w-24">Entry #</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Explanation</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600 w-24">Ref</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600 w-28">Debit ($)</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600 w-28">Credit ($)</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600 w-32">Balance ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {accData.entries.map((entry: any, iIdx: number) => (
                        <tr
                          key={iIdx}
                          className={entry.is_opening ? "bg-amber-50/20 font-medium" : "hover:bg-gray-50/50"}
                        >
                          <td className="px-4 py-1.5 text-gray-600 font-mono">
                            {entry.is_opening ? "May 31 (Bal)" : formatDate(entry.date)}
                          </td>
                          <td className="px-4 py-1.5 font-mono text-blue-600">{entry.entry_number}</td>
                          <td className="px-4 py-1.5 text-gray-800">{entry.description}</td>
                          <td className="px-4 py-1.5 text-gray-400 font-mono">{entry.reference || "—"}</td>
                          <td className="px-4 py-1.5 text-right font-mono">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : ""}
                          </td>
                          <td className="px-4 py-1.5 text-right font-mono">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : ""}
                          </td>
                          <td className="px-4 py-1.5 text-right font-mono font-bold text-gray-900 bg-blue-50/20">
                            {formatCurrency(entry.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t font-semibold text-gray-900">
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-right">
                          Account Totals:
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-blue-700">
                          {formatCurrency(accData.total_debits)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-blue-700">
                          {formatCurrency(accData.total_credits)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-blue-700 font-bold">
                          {formatCurrency(accData.ending_balance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW: Single Account */}
      {viewMode === "single" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">
                Account {singleLedger?.account.code} - {singleLedger?.account.name}
              </h2>
              <p className="text-xs text-gray-500">
                Type: {singleLedger?.account.account_type} | Normal Balance: {singleLedger?.account.normal_balance}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 block">Ending Balance</span>
              <span className="text-base font-bold font-mono text-blue-700">
                {formatCurrency(singleLedger?.ending_balance || 0)}
              </span>
            </div>
          </div>

          {!singleLedger || singleLedger.entries.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No transactions or opening balance recorded for this account.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">Entry #</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">Description</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">Ref</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-600 w-28">Debit ($)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-600 w-28">Credit ($)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-600 w-32">Balance ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {singleLedger.entries.map((item: any, idx: number) => (
                  <tr key={idx} className={item.is_opening ? "bg-amber-50/20 font-medium" : "hover:bg-gray-50/50"}>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap font-mono">
                      {item.is_opening ? "Beginning Balance" : formatDate(item.date)}
                    </td>
                    <td className="px-4 py-2 font-mono font-medium text-blue-600">{item.entry_number}</td>
                    <td className="px-4 py-2 text-gray-800">{item.description}</td>
                    <td className="px-4 py-2 text-gray-400 font-mono">{item.reference || "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-700">
                      {item.debit > 0 ? formatCurrency(item.debit) : ""}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-700">
                      {item.credit > 0 ? formatCurrency(item.credit) : ""}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900 bg-blue-50/30">
                      {formatCurrency(item.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-semibold text-gray-900">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right">
                    Ending Balance:
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">
                    {formatCurrency(singleLedger.total_debits)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">
                    {formatCurrency(singleLedger.total_credits)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700 text-sm">
                    {formatCurrency(singleLedger.ending_balance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
