import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import AssignmentPage from "@/pages/AssignmentPage";

// Lazy-loaded page placeholders — full implementations live in their own files
import { lazy, Suspense } from "react";

const WorkbookPage = lazy(() => import("@/pages/WorkbookPage"));
const AccountsPage = lazy(() => import("@/pages/AccountsPage"));
const JournalEntriesPage = lazy(() => import("@/pages/JournalEntriesPage"));
const LedgerPage = lazy(() => import("@/pages/LedgerPage"));
const TrialBalancePage = lazy(() => import("@/pages/TrialBalancePage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const ReconciliationPage = lazy(() => import("@/pages/ReconciliationPage"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
      <p className="mt-2 text-gray-500">This page is under construction.</p>
    </div>
  );
}

// Wrapper that falls back to a placeholder if the lazy module doesn't exist yet
function SafeLazy({
  factory,
  title,
}: {
  factory: React.LazyExoticComponent<React.ComponentType>;
  title: string;
}) {
  return (
    <Suspense fallback={<PageFallback />}>
      <LazyWithFallback factory={factory} title={title} />
    </Suspense>
  );
}

function LazyWithFallback({
  factory: Component,
  title,
}: {
  factory: React.LazyExoticComponent<React.ComponentType>;
  title: string;
}) {
  try {
    return <Component />;
  } catch {
    return <PlaceholderPage title={title} />;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/assignments/:id" element={<AssignmentPage />} />
          <Route
            path="/accounts"
            element={<SafeLazy factory={AccountsPage} title="Chart of Accounts" />}
          />
          <Route
            path="/workbook/:id"
            element={<SafeLazy factory={WorkbookPage} title="Spreadsheet Workspace" />}
          />
          <Route
            path="/journal-entries"
            element={<SafeLazy factory={JournalEntriesPage} title="Journal Entry Builder" />}
          />
          <Route
            path="/ledger"
            element={<SafeLazy factory={LedgerPage} title="General Ledger" />}
          />
          <Route
            path="/trial-balance"
            element={<SafeLazy factory={TrialBalancePage} title="Trial Balance Generator" />}
          />
          <Route
            path="/reports"
            element={<SafeLazy factory={ReportsPage} title="Financial Statement Builder" />}
          />
          <Route
            path="/reconciliation"
            element={<SafeLazy factory={ReconciliationPage} title="Bank Reconciliation" />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
