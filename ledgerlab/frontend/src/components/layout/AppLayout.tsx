import { NavLink, Outlet, Link } from "react-router-dom";
import { useAssignmentScope } from "@/lib/assignmentScope";
import {
  LayoutDashboard,
  ListTree,
  PenLine,
  BookOpen,
  Scale,
  FileBarChart,
  Landmark,
  PanelLeftClose,
  PanelLeft,
  Save,
  CheckCircle2,
  Loader2,
  FolderOpen,
  X,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";

const navItems = [
  { to: "/accounts", label: "Chart of Accounts", icon: ListTree },
  { to: "/journal-entries", label: "Journal Entries & Feeder", icon: PenLine },
  { to: "/ledger", label: "General Ledger", icon: BookOpen },
  { to: "/trial-balance", label: "Trial Balance", icon: Scale },
  { to: "/reports", label: "Financial Statements", icon: FileBarChart },
  { to: "/reconciliation", label: "Bank Reconciliation", icon: Landmark },
];

export default function AppLayout() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const saveStatus = useAppStore((s) => s.saveStatus);
  const { assignmentId, assignment, withScope } = useAssignmentScope();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* ---- Sidebar ---- */}
      <aside
        className={`flex flex-col border-r border-gray-200 bg-white transition-all duration-200 ${
          sidebarCollapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-14 px-3 border-b border-gray-200">
          {!sidebarCollapsed && (
            <span className="text-lg font-bold tracking-tight text-blue-700">
              LedgerLab
            </span>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-1 px-2">
          <NavLink to="/" end className={linkClass} title={sidebarCollapsed ? "Dashboard" : undefined}>
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </NavLink>

          {/* Current assignment context: all links below stay inside it */}
          {assignmentId && (
            <div
              className={`mt-2 mb-1 rounded-lg border border-indigo-200 bg-indigo-50 ${sidebarCollapsed ? "p-1.5" : "px-3 py-2"}`}
              title={sidebarCollapsed ? assignment?.name : undefined}
            >
              {sidebarCollapsed ? (
                <Link to={`/projects/${assignmentId}`} className="flex justify-center text-indigo-600">
                  <FolderOpen className="h-5 w-5" />
                </Link>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/projects/${assignmentId}`} className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">Project</p>
                    <p className="truncate text-xs font-semibold text-indigo-900 hover:underline">
                      {assignment?.name ?? `#${assignmentId}`}
                    </p>
                  </Link>
                  <Link to="/accounts" className="text-indigo-400 hover:text-indigo-700" title="Exit project (back to global workspace)">
                    <X className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to === "/reconciliation" ? to : withScope(to)}
              className={linkClass}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-gray-200 p-3">
          {!sidebarCollapsed && (
            <p className="text-xs text-gray-400 text-center">
              © {new Date().getFullYear()} LedgerLab
            </p>
          )}
        </div>
      </aside>

      {/* ---- Main area ---- */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between h-14 px-6 border-b border-gray-200 bg-white">
          <h1 className="text-base font-semibold text-gray-700">LedgerLab</h1>

          {/* Save status indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {saveStatus === "saving" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span>Saving…</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Saved</span>
              </>
            )}
            {saveStatus === "error" && (
              <>
                <Save className="h-4 w-4 text-red-500" />
                <span className="text-red-500">Save failed</span>
              </>
            )}
            {saveStatus === "idle" && (
              <>
                <Save className="h-4 w-4" />
                <span>Ready</span>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
