import React, { useEffect, useState, useCallback } from "react";
import WorkbookActions from "@/components/WorkbookActions";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FileSpreadsheet,
  PenLine,
  FileBarChart,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowLeft,
  Pencil,
  Check,
  X,
  ListTree,
  BookOpen,
  Scale,
  ChevronRight,
} from "lucide-react";
import {
  assignmentsApi,
  workbooksApi,
  journalEntriesApi,
  reportsApi,
} from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

type Tab = "workbooks" | "journal-entries" | "reports";

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </span>
      );
    case "in_progress":
    case "in-progress":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          <Clock className="h-3 w-3" /> In Progress
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          <AlertCircle className="h-3 w-3" /> {status || "Draft"}
        </span>
      );
  }
}

const tabs: { key: Tab; label: string; icon: typeof FileSpreadsheet }[] = [
  { key: "workbooks", label: "Workbooks", icon: FileSpreadsheet },
  { key: "journal-entries", label: "Journal Entries", icon: PenLine },
  { key: "reports", label: "Reports", icon: FileBarChart },
];

export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>("workbooks");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");

  // Fetch assignment
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await assignmentsApi.get(Number(id));
      setAssignment(data);
      setEditName(data.name ?? "");
    } catch {
      /* not found */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch tab items
  const loadItems = useCallback(async () => {
    if (!id) return;
    try {
      let data: any[] = [];
      if (activeTab === "workbooks") {
        data = await workbooksApi.list(Number(id));
      } else if (activeTab === "journal-entries") {
        data = await journalEntriesApi.list(Number(id));
      } else if (activeTab === "reports") {
        data = await reportsApi.list(Number(id));
      }
      setItems(data);
    } catch {
      setItems([]);
    }
  }, [id, activeTab]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Rename assignment
  const saveRename = async () => {
    if (!id || !editName.trim()) return;
    await assignmentsApi.update(Number(id), { name: editName.trim() });
    setAssignment((prev: any) => ({ ...prev, name: editName.trim() }));
    setEditing(false);
  };

  // Create item
  const handleCreate = async () => {
    if (!id) return;
    try {
      if (activeTab === "workbooks") {
        const wb = await workbooksApi.create({
          name: `Workbook ${items.length + 1}`,
          assignment_id: Number(id),
        });
        navigate(`/workbook/${wb.id}`);
      } else if (activeTab === "journal-entries") {
        navigate(`/journal-entries?project=${id}`);
      } else if (activeTab === "reports") {
        navigate(`/reports?project=${id}`);
      }
      loadItems();
    } catch (err: any) {
      alert(err.message || "Failed to create");
    }
  };

  // Delete item
  const handleDelete = async (itemId: number) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      if (activeTab === "workbooks") {
        await workbooksApi.delete(itemId);
      } else if (activeTab === "journal-entries") {
        await journalEntriesApi.delete(itemId);
      } else if (activeTab === "reports") {
        await reportsApi.delete(itemId);
      }
      loadItems();
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    }
  };

  // Open item
  const openItem = (itemId: number) => {
    if (activeTab === "workbooks") {
      navigate(`/workbook/${itemId}`);
    } else if (activeTab === "journal-entries") {
      navigate(`/journal-entries?project=${id}`);
    } else {
      navigate(`/reports?project=${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg font-medium">Project not found</p>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
              />
              <button onClick={saveRename} className="p-1 rounded hover:bg-emerald-100 text-emerald-600">
                <Check className="h-5 w-5" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-rose-100 text-rose-500">
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <h1
              className="text-2xl font-bold text-gray-900 flex items-center gap-2 cursor-pointer group"
              onClick={() => setEditing(true)}
            >
              {assignment.name}
              <Pencil className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition" />
            </h1>
          )}
        </div>
        {statusBadge(assignment.status)}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        {assignment.course && <span>Category: {assignment.course}</span>}
        {assignment.created_at && <span>Created: {formatDate(assignment.created_at)}</span>}
        {assignment.due_date && <span>Due: {formatDate(assignment.due_date)}</span>}
      </div>

      {/* Accounting workflow: everything here uses only this assignment's data */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-2xs space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Accounting Workflow</h2>
          <p className="text-xs text-gray-500">
            This project has its own chart of accounts. Journal entries, the general ledger, trial balance and
            financial statements here use only this project's data.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              step: 1,
              label: "Chart of Accounts",
              icon: ListTree,
              path: "/accounts",
              meta: `${assignment.account_count ?? 0} account${assignment.account_count === 1 ? "" : "s"}`,
              hint: assignment.account_count ? "Edit accounts" : "Start here: add or paste accounts",
            },
            {
              step: 2,
              label: "Journal Entries",
              icon: PenLine,
              path: "/journal-entries",
              meta: `${assignment.entry_count ?? 0} entr${assignment.entry_count === 1 ? "y" : "ies"}`,
              hint: assignment.account_count ? "Record transactions" : "Add accounts first",
            },
            { step: 3, label: "General Ledger", icon: BookOpen, path: "/ledger", meta: "Auto-generated", hint: "T-accounts & running balances" },
            { step: 4, label: "Trial Balance", icon: Scale, path: "/trial-balance", meta: "Auto-generated", hint: "Debits = Credits check" },
            { step: 5, label: "Financial Statements", icon: FileBarChart, path: "/reports", meta: "Auto-generated", hint: "Income statement & balance sheet" },
          ].map((s) => (
            <Link
              key={s.step}
              to={`${s.path}?project=${id}`}
              className="group rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/40 transition"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                  {s.step}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500" />
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <s.icon className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-gray-800">{s.label}</span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-gray-600">{s.meta}</p>
              <p className="text-[11px] text-gray-400">{s.hint}</p>
            </Link>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Excel workbook: General Journal, General Ledger, Trial Balance, Income Statement and Balance Sheet —
            formatted, cross-referenced, editable here and downloadable as .xlsx.
          </p>
          <WorkbookActions />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition cursor-pointer",
                activeTab === tab.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Create button */}
      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition shadow-2xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New {activeTab === "journal-entries" ? "Journal Entry" : activeTab === "workbooks" ? "Workbook" : "Report"}
        </button>
      </div>

      {/* Item list */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">
          <p className="font-medium text-gray-600 text-sm">
            No {activeTab.replace("-", " ")} yet
          </p>
          <p className="text-xs text-gray-400 mt-1">Create one using the button above.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item: any) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-2xs hover:shadow-sm transition"
            >
              <div>
                <p className="font-medium text-gray-800 text-sm">
                  {item.name || item.entry_number || item.title || `#${item.id}`}
                </p>
                {item.updated_at && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Updated {formatDate(item.updated_at)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openItem(item.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
