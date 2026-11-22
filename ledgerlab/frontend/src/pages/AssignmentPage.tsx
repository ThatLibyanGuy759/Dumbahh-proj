import React, { useEffect, useState, useCallback } from "react";
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
        navigate(`/journal-entries?assignment_id=${id}`);
      } else if (activeTab === "reports") {
        navigate(`/reports?assignment_id=${id}`);
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
      navigate(`/journal-entries?id=${itemId}`);
    } else {
      navigate(`/reports?id=${itemId}`);
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
        <p className="text-lg font-medium">Assignment not found</p>
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
        {assignment.course && <span>Course: {assignment.course}</span>}
        {assignment.created_at && <span>Created: {formatDate(assignment.created_at)}</span>}
        {assignment.due_date && <span>Due: {formatDate(assignment.due_date)}</span>}
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
