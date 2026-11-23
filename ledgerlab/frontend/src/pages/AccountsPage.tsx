import React, { useState, useEffect } from "react";
import { useAssignmentScope, AssignmentScopeBanner } from "@/lib/assignmentScope";
import {
  ListTree,
  Plus,
  ClipboardPaste,
  Trash2,
  Pencil,
  Check,
  X,
  FileSpreadsheet,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { accountsApi, bulkAccounts, createAccount, updateAccount, deleteAccount, bulkDeleteAccounts } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Account } from "@/types";

type PastedAccount = {
  code: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
  normal_balance: "debit" | "credit";
  opening_balance: number;
};

const inferAccountDetails = (code: string, name: string): Pick<PastedAccount, "account_type" | "normal_balance"> => {
  const lowerName = name.toLowerCase();

  if (lowerName.includes("capital")) return { account_type: "equity", normal_balance: "credit" };
  if (lowerName.includes("drawing")) return { account_type: "equity", normal_balance: "debit" };
  if (lowerName.includes("expense") || lowerName.includes("cost")) return { account_type: "expense", normal_balance: "debit" };
  if (lowerName.includes("sales") || lowerName.includes("fees") || lowerName.includes("revenue") || lowerName.includes("income")) {
    return { account_type: "revenue", normal_balance: "credit" };
  }
  if (lowerName.includes("payable") || lowerName.includes("loan") || lowerName.includes("mortgage") || lowerName.includes("unearned")) {
    return { account_type: "liability", normal_balance: "credit" };
  }
  if (code.startsWith("1")) return { account_type: "asset", normal_balance: "debit" };
  if (code.startsWith("2")) return { account_type: "liability", normal_balance: "credit" };
  if (code.startsWith("3")) return { account_type: "equity", normal_balance: "credit" };
  if (code.startsWith("4")) return { account_type: "revenue", normal_balance: "credit" };
  if (code.startsWith("5") || code.startsWith("6")) return { account_type: "expense", normal_balance: "debit" };
  return { account_type: "asset", normal_balance: "debit" };
};

const parseOpeningBalance = (value: string | undefined): number => {
  if (!value) return 0;

  const trimmed = value.trim();
  const isNegative = /^\(.*\)$/.test(trimmed);
  const numberMatch = trimmed.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!numberMatch) return 0;

  const amount = parseFloat(numberMatch[0].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return 0;
  return isNegative ? -Math.abs(amount) : amount;
};

const CODE_ONLY = /^#?\d{1,5}$/;
const AMOUNT_ONLY = /^\(?-?\$?\s*-?\d[\d,]*(?:\.\d+)?\)?(?:\s*(?:CR|DR))?$/i;

// Converts "one field per line" pastes (e.g. copied from a web/Word table):
//   100
//   Cash
//   $1,300.00
//   301
//   Mr. Scarpelli, Drawings
// into tab-separated rows: "100\tCash\t$1,300.00". Other lines pass through unchanged.
const normalizeVerticalRows = (rawLines: string[]): string[] => {
  const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];

    // A code on its own line followed by a title line (not a code/amount) starts a vertical record
    if (CODE_ONLY.test(line) && next !== undefined && !AMOUNT_ONLY.test(next)) {
      const code = line;
      const name = next;
      i += 2;

      let balance = "";
      const candidate = lines[i];
      if (candidate !== undefined && AMOUNT_ONLY.test(candidate)) {
        if (!CODE_ONLY.test(candidate)) {
          // Clearly an amount ($, decimals, commas, parentheses)
          balance = candidate;
          i += 1;
        } else {
          // Bare number like "1300": treat as a balance only if it isn't the start of the next record
          const after = lines[i + 1];
          const startsNextRecord = after !== undefined && !AMOUNT_ONLY.test(after);
          if (!startsNextRecord) {
            balance = candidate;
            i += 1;
          }
        }
      }

      out.push(`${code}\t${name}\t${balance}`);
      continue;
    }

    out.push(line);
    i += 1;
  }

  return out;
};

export default function AccountsPage() {
  const { assignmentId, assignment, withScope } = useAssignmentScope();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Single account modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"asset" | "liability" | "equity" | "revenue" | "expense">("asset");
  const [newNormBal, setNewNormBal] = useState<"debit" | "credit">("debit");
  const [newOpenBal, setNewOpenBal] = useState("");

  // Paste accounts modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await accountsApi.list(assignmentId);
      setAccounts(data);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === accounts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(accounts.map((a) => a.id));
    }
  };

  const handleBulkDelete = async (targetIds?: number[], isAll = false) => {
    const idsToDelete = isAll ? undefined : (targetIds || selectedIds);
    const count = isAll ? accounts.length : (idsToDelete ? idsToDelete.length : 0);

    if (!isAll && (!idsToDelete || idsToDelete.length === 0)) return;

    const confirmMsg = isAll
      ? `Are you sure you want to delete ALL ${accounts.length} accounts?`
      : `Are you sure you want to delete the ${count} selected account(s)?`;

    if (!confirm(confirmMsg)) return;

    try {
      await bulkDeleteAccounts({
        account_ids: idsToDelete,
        all: isAll,
        assignment_id: assignmentId ?? null,
      });
      setSelectedIds([]);
      loadData();
    } catch (err: any) {
      if (err.message && (err.message.includes("used in") || err.message.includes("journal entry") || err.has_entries)) {
        if (confirm(`${err.message}\n\nDo you want to FORCE delete and remove all associated journal entries as well?`)) {
          try {
            await bulkDeleteAccounts({
              account_ids: idsToDelete,
              all: isAll,
        assignment_id: assignmentId ?? null,
              force: true,
            });
            setSelectedIds([]);
            loadData();
          } catch (forceErr: any) {
            alert(forceErr.message || "Failed to force delete accounts");
          }
        }
      } else {
        alert(err.message || "Failed to delete selected accounts");
      }
    }
  };

  // Update normal balance when type changes
  const handleTypeChange = (type: "asset" | "liability" | "equity" | "revenue" | "expense") => {
    setNewType(type);
    if (type === "asset" || type === "expense") {
      setNewNormBal("debit");
    } else {
      setNewNormBal("credit");
    }
  };

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;
    try {
      await createAccount({
        assignment_id: assignmentId ?? null,
        code: newCode.trim(),
        name: newName.trim(),
        account_type: newType,
        normal_balance: newNormBal,
        opening_balance: parseFloat(newOpenBal) || 0.0,
      });
      setShowAddModal(false);
      setNewCode("");
      setNewName("");
      setNewOpenBal("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create account");
    }
  };

  // Helper to parse pasted raw lines of accounts
  const handleParsePastedText = (text: string) => {
    setPasteText(text);
    const lines = normalizeVerticalRows(text.split(/\r?\n/));
    const preview: PastedAccount[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      let code = "";
      let name = "";
      let balanceText: string | undefined;

      if (line.includes("|")) {
        // Supports: 100 | Cash | $1,300.00
        const parts = line.split("|").map((part) => part.trim());
        code = parts[0];
        name = parts[1] || "";
        balanceText = parts[2];
      } else if (line.includes("\t")) {
        const parts = line.split("\t").map((part) => part.trim());
        code = parts[0];
        name = parts[1] || "";
        balanceText = parts[2];
      } else {
        // Supports: 100 Cash $1,300.00
        const match = line.match(/^(\d{1,5})\s+(.+?)(?:\s+\(?\$?-?\d[\d,]*(?:\.\d+)?\)?(?:\s*(?:CR|DR))?)?$/i);
        if (match) {
          code = match[1].trim();
          const balanceMatch = match[2].match(/^(.*?)(?:\s+((?:\(?\$?-?\d[\d,]*(?:\.\d+)?\)?)(?:\s*(?:CR|DR))?))$/i);
          if (balanceMatch) {
            name = balanceMatch[1].trim();
            balanceText = balanceMatch[2];
          } else {
            name = match[2].trim();
          }
        } else {
          continue;
        }
      }

      code = code.replace(/^\#/, "").trim();
      name = name.replace(/^["']|["']$/g, "").trim();
      if (!/^\d{1,5}$/.test(code) || !name) continue;

      preview.push({
        code,
        name,
        ...inferAccountDetails(code, name),
        opening_balance: parseOpeningBalance(balanceText),
      });
    }

    setParsedPreview(preview);
  };

  const handleSaveBulkAccounts = async () => {
    if (parsedPreview.length === 0) return;
    try {
      await bulkAccounts({
        replace: true,
        assignment_id: assignmentId ?? null,
        accounts: parsedPreview,
      });
      setShowPasteModal(false);
      setPasteText("");
      setParsedPreview([]);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to save bulk accounts");
    }
  };

  const handleLoadScarpelliExample = () => {
    const scarpelliText = `100 Cash $1,300.00
101 Accounts Receivable $1,400.00
102 Supplies $300.00
103 Land $93,000.00
104 Building $104,000.00
105 Equipment $11,400.00
200 Accounts Payable $2,100.00
201 Bank Loan $10,100.00
202 Mortgage $165,000.00
300 Mr. Scarpelli, Capital $34,200.00
301 Mr. Scarpelli, Drawings
400 Sales
401 Fees Earned
500 Salaries Expense
501 Advertising Expense
502 Delivery Expense
503 Hydro Expense
504 Water Expense
505 Miscellaneous Expense`;

    setShowPasteModal(true);
    handleParsePastedText(scarpelliText);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this account?")) return;
    try {
      await deleteAccount(id);
      loadData();
    } catch (err: any) {
      if (err.message && (err.message.includes("used in") || err.message.includes("journal entry"))) {
        if (confirm(`${err.message}\n\nDo you want to proceed and delete the account along with its transactions?`)) {
          try {
            await deleteAccount(id, true);
            loadData();
          } catch (delErr: any) {
            alert(delErr.message || "Failed to force delete account");
          }
        }
      } else {
        alert(err.message || "Failed to delete account");
      }
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <AssignmentScopeBanner />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListTree className="h-6 w-6 text-blue-600" />
            Chart of Accounts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure custom account numbers, account titles, normal balances, and beginning opening balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {accounts.length > 0 && (
            <button
              onClick={() => handleBulkDelete(undefined, true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-md text-xs font-medium transition cursor-pointer"
              title="Delete all accounts in this chart"
            >
              <Trash2 className="h-4 w-4" /> Clear All Accounts
            </button>
          )}
          <button
            onClick={handleLoadScarpelliExample}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-medium transition cursor-pointer"
          >
            <Sparkles className="h-4 w-4" /> Load Mr. Scarpelli Example
          </button>
          <button
            onClick={() => setShowPasteModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
          >
            <ClipboardPaste className="h-4 w-4 text-blue-600" /> Quick Paste Accounts
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer shadow-2xs"
          >
            <Plus className="h-4 w-4" /> Add Account
          </button>
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-3 flex items-center justify-between text-xs shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-rose-900 bg-rose-100 px-2 py-0.5 rounded-full">
              {selectedIds.length}
            </span>
            <span className="text-rose-800 font-medium">
              account{selectedIds.length > 1 ? "s" : ""} selected for deletion
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition cursor-pointer font-medium"
            >
              Deselect All
            </button>
            <button
              onClick={() => handleBulkDelete()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-semibold transition cursor-pointer shadow-2xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Account Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            Accounts ({accounts.length})
          </h2>
          <span className="text-xs text-gray-500">
            Accounts with non-zero opening balances carry into the General Ledger and Trial Balance.
          </span>
        </div>

        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2.5 text-center w-10">
                <input
                  type="checkbox"
                  checked={accounts.length > 0 && selectedIds.length === accounts.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                  title="Select All Accounts"
                />
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700 w-24">Number / Code</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Account Title</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700 w-32">Classification</th>
              <th className="px-4 py-2.5 text-center font-semibold text-gray-700 w-28">Normal Balance</th>
              <th className="px-4 py-2.5 text-right font-semibold text-gray-700 w-36">Opening Balance ($)</th>
              <th className="px-2 py-2.5 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400">Loading accounts...</td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  No accounts yet. Use "Quick Paste Accounts" or "Add Account" to configure your chart of accounts.
                </td>
              </tr>
            ) : (
              accounts.map((acc) => (
                <tr
                  key={acc.id}
                  className={`transition ${
                    selectedIds.includes(acc.id) ? "bg-rose-50/40" : "hover:bg-gray-50/50"
                  }`}
                >
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(acc.id)}
                      onChange={() => toggleSelect(acc.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                    />
                  </td>
                  <td className="px-4 py-2 font-mono font-bold text-blue-700">{acc.code}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{acc.name}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                      acc.account_type === "asset"
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : acc.account_type === "liability"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : acc.account_type === "equity"
                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                        : acc.account_type === "revenue"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}>
                      {acc.account_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center capitalize font-mono text-gray-600">
                    {acc.normal_balance}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-gray-800">
                    {acc.opening_balance > 0 ? formatCurrency(acc.opening_balance) : "—"}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="p-1 text-gray-400 hover:text-rose-600 transition"
                      title="Delete Account"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Single Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Add Account</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSingle} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Account Number / Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 100, 101, 200, 300, 400"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 mb-1">Account Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cash, Accounts Receivable, Sales"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Classification</label>
                  <select
                    value={newType}
                    onChange={(e: any) => handleTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Owner's Equity</option>
                    <option value="revenue">Revenue</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Normal Balance</label>
                  <select
                    value={newNormBal}
                    onChange={(e: any) => setNewNormBal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-gray-700 mb-1">Beginning / Opening Balance ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newOpenBal}
                  onChange={(e) => setNewOpenBal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-md shadow-2xs"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Paste Accounts Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Quick Paste Chart of Accounts</h3>
                <p className="text-xs text-gray-500">
                  Paste rows directly (pipe, tab, or space separated), or a copied table with one field per line.
                </p>
              </div>
              <button onClick={() => setShowPasteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto">
              <label className="block text-xs font-semibold text-gray-700">Paste Lines Below:</label>
              <textarea
                rows={8}
                value={pasteText}
                onChange={(e) => handleParsePastedText(e.target.value)}
                placeholder={`100 Cash $1,300.00\n101 Accounts Receivable $1,400.00\n102 Supplies $300.00\n200 Accounts Payable $2,100.00\n300 Mr. Scarpelli, Capital $34,200.00\n400 Sales`}
                className="w-full text-xs font-mono px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
              />

              {parsedPreview.length > 0 && (
                <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 flex justify-between">
                    <span>Parsed Preview ({parsedPreview.length} accounts found)</span>
                    <span className="text-blue-700 font-bold">Ready to Save</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-1 text-left">Code</th>
                          <th className="px-3 py-1 text-left">Title</th>
                          <th className="px-3 py-1 text-left">Type</th>
                          <th className="px-3 py-1 text-right">Opening Bal ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedPreview.map((item, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-1 font-mono font-bold text-blue-600">{item.code}</td>
                            <td className="px-3 py-1 text-gray-800">{item.name}</td>
                            <td className="px-3 py-1 uppercase text-[10px] font-semibold text-gray-500">{item.account_type}</td>
                            <td className="px-3 py-1 text-right font-mono font-semibold">
                              {item.opening_balance > 0 ? formatCurrency(item.opening_balance) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBulkAccounts}
                disabled={parsedPreview.length === 0}
                className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-md shadow-2xs disabled:opacity-50"
              >
                Save {parsedPreview.length} Accounts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
