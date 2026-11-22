import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileSpreadsheet,
  PenLine,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sprout,
  X,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { workbooksApi } from "@/lib/api";

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const assignments = useAppStore((s) => s.assignments);
  const accounts = useAppStore((s) => s.accounts);
  const loadAssignments = useAppStore((s) => s.loadAssignments);
  const loadAccounts = useAppStore((s) => s.loadAccounts);
  const seedAccounts = useAppStore((s) => s.seedAccounts);
  const createAssignment = useAppStore((s) => s.createAssignment);

  // Modal states
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showWorkbookModal, setShowWorkbookModal] = useState(false);

  // New assignment form
  const [assignName, setAssignName] = useState("");
  const [assignCourse, setAssignCourse] = useState("");
  const [assignDesc, setAssignDesc] = useState("");

  // New workbook form
  const [wbName, setWbName] = useState("");
  const [wbAssignmentId, setWbAssignmentId] = useState<number | "">("");

  useEffect(() => {
    loadAssignments();
    loadAccounts();
  }, [loadAssignments, loadAccounts]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignName.trim()) return;
    try {
      const created = await createAssignment({
        name: assignName.trim(),
        course: assignCourse.trim(),
        description: assignDesc.trim(),
        status: "in_progress",
      });
      setShowAssignmentModal(false);
      setAssignName("");
      setAssignCourse("");
      setAssignDesc("");
      navigate(`/assignments/${created.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to create assignment");
    }
  };

  const handleCreateWorkbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wbName.trim()) return;
    try {
      const wb = await workbooksApi.create({
        name: wbName.trim(),
        assignment_id: wbAssignmentId || null,
      });
      setShowWorkbookModal(false);
      setWbName("");
      setWbAssignmentId("");
      navigate(`/workbook/${wb.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to create workbook");
    }
  };

  const quickActions = [
    {
      label: "New Assignment",
      icon: Plus,
      color: "bg-blue-600 hover:bg-blue-700",
      onClick: () => setShowAssignmentModal(true),
    },
    {
      label: "Feed Transactions (Auto-Parser)",
      icon: PenLine,
      color: "bg-emerald-600 hover:bg-emerald-700",
      onClick: () => navigate("/journal-entries"),
    },
    {
      label: "Chart of Accounts",
      icon: BookOpen,
      color: "bg-purple-600 hover:bg-purple-700",
      onClick: () => navigate("/accounts"),
    },
    {
      label: "New Workbook",
      icon: FileSpreadsheet,
      color: "bg-indigo-600 hover:bg-indigo-700",
      onClick: () => setShowWorkbookModal(true),
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* ---- Welcome header ---- */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome to <span className="text-blue-700">LedgerLab</span>
        </h1>
        <p className="mt-1 text-gray-500 text-sm">
          Accounting-specific workspace with full Excel-style formula spreadsheet, journal entry builder,
          general ledger, trial balance, and professional statement generator.
        </p>
      </div>

      {/* ---- Quick actions ---- */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`flex items-center gap-3 rounded-xl px-5 py-4 text-white font-medium shadow-2xs transition cursor-pointer ${action.color}`}
            >
              <action.icon className="h-5 w-5" />
              {action.label}
            </button>
          ))}
        </div>
      </section>

      {/* ---- Seed accounts CTA ---- */}
      {accounts.length === 0 && (
        <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sprout className="h-6 w-6 text-blue-600" />
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                No chart of accounts loaded
              </p>
              <p className="text-xs text-gray-500">
                Seed a standard 25-account chart of accounts to get started quickly.
              </p>
            </div>
          </div>
          <button
            onClick={seedAccounts}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition"
          >
            Seed Accounts
          </button>
        </div>
      )}

      {/* ---- Recent assignments ---- */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
          Assignments ({assignments.length})
        </h2>

        {assignments.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">
            <BookOpen className="mx-auto h-10 w-10 mb-3 text-gray-300" />
            <p className="font-medium text-gray-600 text-sm">No assignments yet</p>
            <p className="text-xs text-gray-400 mt-1">Create one with the button above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignments.map((a: any) => (
              <Link
                key={a.id}
                to={`/assignments/${a.id}`}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-2xs hover:shadow-md transition group"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-800 group-hover:text-blue-700 transition text-sm">
                    {a.name}
                  </h3>
                  {statusBadge(a.status)}
                </div>

                {a.course && (
                  <p className="mt-1 text-xs text-gray-500">{a.course}</p>
                )}

                <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {a.workbook_count ?? 0} workbook{(a.workbook_count !== 1) ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {a.report_count ?? 0} report{(a.report_count !== 1) ? "s" : ""}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---- Assignment Modal ---- */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">New Assignment Workspace</h3>
              <button onClick={() => setShowAssignmentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assignment Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assignment 03 – Financial Statements"
                  value={assignName}
                  onChange={(e) => setAssignName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Course / Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Financial Accounting 101"
                  value={assignCourse}
                  onChange={(e) => setAssignCourse(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or instructions"
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignmentModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-md shadow-2xs"
                >
                  Create Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- Workbook Modal ---- */}
      {showWorkbookModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">New Spreadsheet Workbook</h3>
              <button onClick={() => setShowWorkbookModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateWorkbook} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Workbook Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Financial Model"
                  value={wbName}
                  onChange={(e) => setWbName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assign to Assignment (Optional)</label>
                <select
                  value={wbAssignmentId}
                  onChange={(e) => setWbAssignmentId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">None (Standalone)</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWorkbookModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 font-medium rounded-md shadow-2xs"
                >
                  Create & Open
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
