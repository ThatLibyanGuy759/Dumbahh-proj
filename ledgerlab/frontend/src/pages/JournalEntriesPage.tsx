import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  PenLine,
  Sparkles,
  ClipboardPaste,
  BookOpen,
  Scale,
  FileBarChart,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Printer,
  Save,
  Send,
  ArrowRight,
} from "lucide-react";
import {
  getAccounts,
  getJournalEntries,
  createJournalEntry,
  postJournalEntry,
  deleteJournalEntry,
  autoParseTransactions,
  bulkCreateJournalEntries,
  getGeneralJournal,
  journalEntriesApi,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Account, JournalEntry } from "@/types";

export default function JournalEntriesPage() {
  const [activeTab, setActiveTab] = useState<"feeder" | "journal" | "manual">("feeder");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart Feeder State
  const [rawText, setRawText] = useState("");
  const [defaultYear, setDefaultYear] = useState(2025);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [postSuccess, setPostSuccess] = useState(false);

  // General Journal View state
  const [generalJournal, setGeneralJournal] = useState<{ entries: any[]; total_debits: number; total_credits: number } | null>(null);

  // Manual Entry Form State
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<
    { account_id: number; debit: number; credit: number; description: string }[]
  >([
    { account_id: 0, debit: 0, credit: 0, description: "" },
    { account_id: 0, debit: 0, credit: 0, description: "" },
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const accs = await getAccounts();
      setAccounts(accs);
      const jes = await getJournalEntries();
      setEntries(jes);
      const gj = await getGeneralJournal();
      setGeneralJournal(gj);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Preset example from user's homework prompt
  const handleLoadScarpelliPrompt = () => {
    const scarpelliTxns = `June 4: Customer was invoiced $1900.00 for sale of stock to be paid within 30 days
June 7: Paid $160.00 to pay for water expense
June 8: Paid $290.00 to pay for advertising expense
June 10: Paid $250.00 to pay for salaries expense
June 12: Bought $1400.00 worth of supplies on credit, to be paid off within 30 days
June 15: $200.00 paid for advertising service
June 17: Traded in $1000.00 worth of old equipment for store credit we will use within 30 days.
June 18: $50.00 paid for advertising service
June 21: Returned $3000.00 worth of old equipment, but will be refunded within 30 days.
June 22: $230.00 paid for advertising service
June 25: Refunded $3700.00 worth of equipment for cash
June 27: Paid $220.00 to pay for hydro expense`;

    setRawText(scarpelliTxns);
    handleParseText(scarpelliTxns);
  };

  const handleParseText = async (textToParse?: string) => {
    const text = textToParse !== undefined ? textToParse : rawText;
    if (!text.trim()) return;
    setIsParsing(true);
    try {
      const res = await autoParseTransactions(text, null, defaultYear);
      setParsedRows(res.entries);
      setPostSuccess(false);
    } catch (err: any) {
      alert(err.message || "Failed to parse transactions");
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdateParsedRow = (idx: number, field: string, val: any) => {
    const updated = [...parsedRows];
    updated[idx][field] = val;
    if (field === "debit_account_id") {
      const acc = accounts.find((a) => a.id === Number(val));
      if (acc) {
        updated[idx].debit_account_code = acc.code;
        updated[idx].debit_account_name = acc.name;
      }
    } else if (field === "credit_account_id") {
      const acc = accounts.find((a) => a.id === Number(val));
      if (acc) {
        updated[idx].credit_account_code = acc.code;
        updated[idx].credit_account_name = acc.name;
      }
    }
    updated[idx].is_balanced =
      updated[idx].amount > 0 &&
      Boolean(updated[idx].debit_account_id) &&
      Boolean(updated[idx].credit_account_id);
    setParsedRows(updated);
  };

  const handlePostAllParsed = async () => {
    if (parsedRows.length === 0) return;
    try {
      await bulkCreateJournalEntries(parsedRows, null, true);
      setPostSuccess(true);
      setParsedRows([]);
      setRawText("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to post entries");
    }
  };

  const handleClearEntries = async () => {
    if (!confirm("Clear all recorded journal entries?")) return;
    try {
      await journalEntriesApi.clear();
      setPostSuccess(false);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to clear");
    }
  };

  // Manual entry handlers
  const handleAddLine = () => {
    setLines([...lines, { account_id: accounts[0]?.id || 0, debit: 0, credit: 0, description: "" }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, val: any) => {
    const updated = [...lines];
    if (field === "debit") {
      updated[idx].debit = parseFloat(val) || 0;
      if (parseFloat(val) > 0) updated[idx].credit = 0;
    } else if (field === "credit") {
      updated[idx].credit = parseFloat(val) || 0;
      if (parseFloat(val) > 0) updated[idx].debit = 0;
    } else if (field === "account_id") {
      updated[idx].account_id = Number(val);
    } else {
      updated[idx].description = val;
    }
    setLines(updated);
  };

  const totalDebits = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const handleSubmitManual = async (status: "draft" | "posted") => {
    if (status === "posted" && !isBalanced) {
      alert("Debits must equal Credits to post a journal entry!");
      return;
    }
    try {
      const entry = await createJournalEntry({
        date,
        description,
        reference,
        status: "draft",
        lines: lines.filter((l) => l.account_id && (l.debit > 0 || l.credit > 0)),
      });

      if (status === "posted") {
        await postJournalEntry(entry.id);
      }

      setDescription("");
      setReference("");
      setLines([
        { account_id: accounts[0]?.id || 0, debit: 0, credit: 0, description: "" },
        { account_id: accounts[0]?.id || 0, debit: 0, credit: 0, description: "" },
      ]);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create entry");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PenLine className="h-6 w-6 text-blue-600" />
            General Journal & Transaction Feeder
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Feed days of transaction notes to auto-generate journal entries, or review the complete General Journal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              onClick={handleClearEntries}
              className="px-3 py-1.5 border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md text-xs font-medium transition cursor-pointer"
            >
              Reset / Clear Entries
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("feeder")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === "feeder"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Sparkles className="h-4 w-4 text-blue-600" />
          Smart Transaction Feeder (Auto-Generate)
        </button>
        <button
          onClick={() => setActiveTab("journal")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === "journal"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          General Journal ({entries.length} posted)
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === "manual"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Plus className="h-4 w-4" />
          Manual Journal Entry
        </button>
      </div>

      {/* TAB 1: Smart Transaction Feeder */}
      {activeTab === "feeder" && (
        <div className="space-y-6">
          {/* Post Success Banner with Quick Links */}
          {postSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                All transactions were successfully parsed, balanced, and posted!
              </div>
              <p className="text-xs text-emerald-700">
                The General Ledger, Trial Balance, Income Statement, and Balance Sheet have been automatically updated.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/ledger"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-md text-xs font-semibold hover:bg-emerald-100 transition"
                >
                  <BookOpen className="h-3.5 w-3.5" /> View General Ledger
                </Link>
                <Link
                  to="/trial-balance"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-md text-xs font-semibold hover:bg-emerald-100 transition"
                >
                  <Scale className="h-3.5 w-3.5" /> View Trial Balance
                </Link>
                <Link
                  to="/reports"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-md text-xs font-semibold hover:bg-emerald-100 transition"
                >
                  <FileBarChart className="h-3.5 w-3.5" /> View Financial Statements
                </Link>
              </div>
            </div>
          )}

          {/* Feeder Input Box */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <ClipboardPaste className="h-4 w-4 text-blue-600" />
                  Feed Days of Transactions
                </h2>
                <p className="text-xs text-gray-500">
                  Paste your assignment's transaction log line-by-line. The parser matches dates, amounts, and accounts.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <label>Default Year:</label>
                  <input
                    type="number"
                    value={defaultYear}
                    onChange={(e) => setDefaultYear(Number(e.target.value))}
                    className="w-18 px-2 py-1 border rounded text-xs text-center font-mono"
                  />
                </div>
                <button
                  onClick={handleLoadScarpelliPrompt}
                  className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-medium transition cursor-pointer"
                >
                  Load June 2025 Assignment Example
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`June 4: Customer was invoiced $1900.00 for sale of stock to be paid within 30 days\nJune 7: Paid $160.00 to pay for water expense\nJune 8: Paid $290.00 to pay for advertising expense\nJune 10: Paid $250.00 to pay for salaries expense\nJune 12: Bought $1400.00 worth of supplies on credit, to be paid off within 30 days`}
              className="w-full text-xs font-mono px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
            />

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-gray-400">
                {rawText.trim() ? `${rawText.trim().split("\n").length} transaction line(s)` : "Empty"}
              </span>
              <button
                onClick={() => handleParseText()}
                disabled={isParsing || !rawText.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <Sparkles className="h-4 w-4" />
                {isParsing ? "Analyzing Transactions..." : "Parse & Review Entries"}
              </button>
            </div>
          </div>

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden space-y-4 p-6">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">
                    Review Proposed Journal Entries ({parsedRows.length})
                  </h3>
                  <p className="text-xs text-gray-500">
                    Confirm or adjust the debit/credit accounts before posting to the General Ledger.
                  </p>
                </div>
                <button
                  onClick={handlePostAllParsed}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Send className="h-4 w-4" /> Auto-Generate & Post All Entries
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Description</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 w-52">Debit Account</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 w-52">Credit Account</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700 w-28">Amount ($)</th>
                      <th className="px-2 py-2 text-center w-12">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => handleUpdateParsedRow(idx, "date", e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => handleUpdateParsedRow(idx, "description", e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.debit_account_id || ""}
                            onChange={(e) => handleUpdateParsedRow(idx, "debit_account_id", e.target.value)}
                            className="w-full border border-blue-300 bg-blue-50/30 rounded px-2 py-1 text-xs font-medium"
                          >
                            <option value="">Select Account...</option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.code} – {acc.name} ({acc.account_type})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.credit_account_id || ""}
                            onChange={(e) => handleUpdateParsedRow(idx, "credit_account_id", e.target.value)}
                            className="w-full border border-emerald-300 bg-emerald-50/30 rounded px-2 py-1 text-xs font-medium"
                          >
                            <option value="">Select Account...</option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.code} – {acc.name} ({acc.account_type})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => handleUpdateParsedRow(idx, "amount", parseFloat(e.target.value) || 0)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right font-mono font-bold"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          {row.is_balanced ? (
                            <span title="Balanced">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 inline" />
                            </span>
                          ) : (
                            <span title="Incomplete or missing account">
                              <XCircle className="h-4 w-4 text-rose-600 inline" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 font-bold">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right text-gray-700">
                        Total Transaction Volume:
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-blue-700">
                        {formatCurrency(parsedRows.reduce((sum, r) => sum + (r.amount || 0), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: General Journal (Classic Textbook Format) */}
      {activeTab === "journal" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-xl font-bold uppercase tracking-wider text-gray-900 font-serif">
                General Journal
              </h2>
              <p className="text-xs text-gray-500">
                Official double-entry recording of transactions in chronological sequence.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <Printer className="h-4 w-4" /> Print Journal
            </button>
          </div>

          {!generalJournal || generalJournal.entries.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No journal entries recorded. Feed transactions above to populate the General Journal.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border border-gray-300">
                <thead className="bg-gray-100 border-b border-gray-300 font-semibold text-gray-700">
                  <tr>
                    <th className="px-4 py-2.5 text-left border-r border-gray-300 w-28">Date</th>
                    <th className="px-4 py-2.5 text-left border-r border-gray-300">Account Titles and Explanation</th>
                    <th className="px-4 py-2.5 text-center border-r border-gray-300 w-20">PR / Ref</th>
                    <th className="px-4 py-2.5 text-right border-r border-gray-300 w-32">Debit ($)</th>
                    <th className="px-4 py-2.5 text-right w-32">Credit ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {generalJournal.entries.map((entry) => (
                    <React.Fragment key={entry.id}>
                      {entry.lines.map((line: any, lIdx: number) => {
                        const isCredit = line.credit > 0;
                        return (
                          <tr key={lIdx} className="hover:bg-gray-50/40">
                            <td className="px-4 py-1.5 text-gray-600 border-r border-gray-200 font-mono">
                              {lIdx === 0 ? formatDate(entry.date) : ""}
                            </td>
                            <td className={`px-4 py-1.5 border-r border-gray-200 ${isCredit ? "pl-10 italic text-gray-700" : "font-medium text-gray-900"}`}>
                              {line.account_name}
                            </td>
                            <td className="px-4 py-1.5 text-center border-r border-gray-200 font-mono text-gray-500">
                              {line.account_code || line.account_id}
                            </td>
                            <td className="px-4 py-1.5 text-right font-mono border-r border-gray-200 text-gray-900">
                              {line.debit > 0 ? formatCurrency(line.debit) : ""}
                            </td>
                            <td className="px-4 py-1.5 text-right font-mono text-gray-900">
                              {line.credit > 0 ? formatCurrency(line.credit) : ""}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Memo explanation row */}
                      <tr className="border-b border-gray-300 bg-gray-50/20">
                        <td className="border-r border-gray-200"></td>
                        <td colSpan={4} className="px-6 py-1 text-[11px] italic text-gray-500">
                          ({entry.description || "To record transaction"} - Ref: {entry.entry_number})
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-400 font-bold text-gray-900">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right border-r border-gray-300">
                      Total
                    </td>
                    <td className="px-4 py-2 text-right font-mono border-r border-gray-300 border-b-4 border-double border-gray-800">
                      {formatCurrency(generalJournal.total_debits)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono border-b-4 border-double border-gray-800">
                      {formatCurrency(generalJournal.total_credits)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Manual Journal Entry */}
      {activeTab === "manual" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-semibold text-gray-800 text-sm">New Manual Entry</h2>
            {isBalanced ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> Balanced
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                <XCircle className="h-3.5 w-3.5" /> Out of Balance (Diff: {formatCurrency(Math.abs(totalDebits - totalCredits))})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description / Memo</label>
              <input
                type="text"
                placeholder="e.g. Paid cash for supplies"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reference</label>
              <input
                type="text"
                placeholder="e.g. Chq #102"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <table className="min-w-full divide-y divide-gray-200 text-xs border border-gray-200 rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-left">Line Memo</th>
                <th className="px-3 py-2 text-right w-32">Debit ($)</th>
                <th className="px-3 py-2 text-right w-32">Credit ($)</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-1.5">
                    <select
                      value={line.account_id}
                      onChange={(e) => handleLineChange(idx, "account_id", e.target.value)}
                      className="w-full border rounded px-2 py-1 text-xs"
                    >
                      <option value={0}>Select Account...</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} – {acc.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                      className="w-full border rounded px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={line.debit || ""}
                      onChange={(e) => handleLineChange(idx, "debit", e.target.value)}
                      className="w-full border rounded px-2 py-1 text-xs text-right font-mono"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={line.credit || ""}
                      onChange={(e) => handleLineChange(idx, "credit", e.target.value)}
                      className="w-full border rounded px-2 py-1 text-xs text-right font-mono"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => handleRemoveLine(idx)}
                      disabled={lines.length <= 2}
                      className="text-gray-400 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-bold border-t">
              <tr>
                <td colSpan={2} className="px-3 py-2">
                  <button onClick={handleAddLine} className="text-blue-600 flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add Line
                  </button>
                </td>
                <td className="px-3 py-2 text-right font-mono">{formatCurrency(totalDebits)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatCurrency(totalCredits)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => handleSubmitManual("draft")}
              className="px-4 py-2 border rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSubmitManual("posted")}
              disabled={!isBalanced}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold disabled:opacity-50"
            >
              Post Entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
