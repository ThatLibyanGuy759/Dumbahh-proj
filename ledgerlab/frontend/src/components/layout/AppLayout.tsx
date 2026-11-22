import { NavLink, Outlet } from "react-router-dom";
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
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
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
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
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
