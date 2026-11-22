import React, { useState, useEffect } from "react";
import {
  Landmark,
  Plus,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  Trash2,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import {
  getBankTransactions,
  createBankTransaction,
  reconcileBankTransaction,
  unreconcileBankTransaction,
  deleteBankTransaction,
  getBankSummary,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BankTransaction } from "@/types";

export default function ReconciliationPage() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const txns = await getBankTransactions();
      setTransactions(txns);
      const summ = await getBankSummary();
      setSummary(summ);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    try {
      await createBankTransaction({
        date,
        description,
        amount: parseFloat(amount),
        reference,
      });
      setDescription("");
      setAmount("");
      setReference("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to add bank transaction");
    }
  };

  const handleToggleReconcile = async (txn: BankTransaction) => {
    try {
      if (txn.is_reconciled) {
        await unreconcileBankTransaction(txn.id);
      } else {
        await reconcileBankTransaction(txn.id, {});
      }
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update transaction");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this bank transaction?")) return;
    try {
      await deleteBankTransaction(id);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Landmark className="h-6 w-6 text-blue-600" />
          Bank Reconciliation
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Verify and compare bank statement records against company general ledger entries.
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-xs text-gray-500 block">Total Statement Records</span>
          <span className="text-xl font-bold text-gray-800">
            {summary?.total_transactions || 0}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-xs text-emerald-600 block">Reconciled Items</span>
          <span className="text-xl font-bold text-emerald-700">
            {summary?.reconciled_count || 0}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-xs text-rose-600 block">Unreconciled Discrepancies</span>
          <span className="text-xl font-bold text-rose-700">
            {summary?.unreconciled_count || 0}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-xs text-blue-600 block">Unreconciled Total</span>
          <span className="text-xl font-bold font-mono text-blue-700">
            {formatCurrency(summary?.unreconciled_total || 0)}
          </span>
        </div>
      </div>

      {/* Manual Entry Form */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Plus className="h-4 w-4 text-blue-600" /> Add Bank Statement Line
        </h2>
        <form onSubmit={handleAddTransaction} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-xs px-3 py-1.5 border border-gray-300 rounded outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Deposit from customer / Wire fee"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-1.5 border border-gray-300 rounded outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Amount (+ Deposit / - Payment)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-xs px-3 py-1.5 border border-gray-300 rounded outline-none font-mono"
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 rounded transition"
            >
              Add Item
            </button>
          </div>
        </form>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Bank Statement Transactions</h2>
          <span className="text-xs text-gray-400">Click reconcile once verified against general ledger cash account</span>
        </div>

        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Description</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600 w-32">Amount ($)</th>
              <th className="px-4 py-2 text-center font-medium text-gray-600 w-32">Status</th>
              <th className="px-4 py-2 text-center font-medium text-gray-600 w-32">Action</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400 text-xs">
                  No bank transactions entered. Add a line above to begin reconciliation.
                </td>
              </tr>
            ) : (
              transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatDate(txn.date)}</td>
                  <td className="px-4 py-2 text-gray-800 font-medium">{txn.description}</td>
                  <td
                    className={`px-4 py-2 text-right font-mono font-semibold ${
                      txn.amount >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatCurrency(txn.amount)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {txn.is_reconciled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle className="h-3 w-3" /> Reconciled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <AlertCircle className="h-3 w-3" /> Unreconciled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleToggleReconcile(txn)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                        txn.is_reconciled
                          ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          : "bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100"
                      }`}
                    >
                      {txn.is_reconciled ? "Unmark" : "Mark Reconciled"}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => handleDelete(txn.id)}
                      className="text-gray-400 hover:text-rose-600"
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
    </div>
  );
}
