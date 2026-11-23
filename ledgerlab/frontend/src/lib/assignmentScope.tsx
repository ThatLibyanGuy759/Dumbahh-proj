import { useEffect, useState } from "react";
import { Link, useSearchParams, useLocation, matchPath } from "react-router-dom";
import { FolderOpen, ArrowLeft } from "lucide-react";
import { assignmentsApi } from "@/lib/api";

/**
 * Pages are scoped to one project (stored as an "assignment" in the database) via the `?project=` URL param.
 * Without it they operate on the global workspace (accounts/entries with no assignment).
 */
export function useAssignmentScope() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  // Scope comes from ?project= (or legacy ?assignment_id=), or from the project's own page
  const routeMatch = matchPath("/projects/:id", location.pathname) ?? matchPath("/assignments/:id", location.pathname);
  const raw = searchParams.get("project") ?? searchParams.get("assignment_id") ?? routeMatch?.params.id ?? null;
  const parsed = raw ? Number(raw) : NaN;
  const assignmentId = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;

  const [assignment, setAssignment] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    if (!assignmentId) {
      setAssignment(null);
      return;
    }
    assignmentsApi
      .get(assignmentId)
      .then((a) => !cancelled && setAssignment(a))
      .catch(() => !cancelled && setAssignment(null));
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  /** Append the current assignment scope to an in-app path. */
  const withScope = (path: string) => scopedPath(path, assignmentId);

  return { assignmentId, assignment, withScope };
}

export function scopedPath(path: string, assignmentId?: number) {
  if (!assignmentId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}project=${assignmentId}`;
}

/** Banner shown at the top of accounting pages while working inside an assignment. */
export function AssignmentScopeBanner() {
  const { assignmentId, assignment } = useAssignmentScope();
  if (!assignmentId) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs">
      <div className="flex items-center gap-2 text-indigo-900">
        <FolderOpen className="h-4 w-4 text-indigo-600" />
        <span>
          Working in project:{" "}
          <span className="font-semibold">{assignment?.name ?? `#${assignmentId}`}</span>
        </span>
        <span className="text-indigo-500">— only this project's accounts and entries are used.</span>
      </div>
      <Link
        to={`/projects/${assignmentId}`}
        className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:text-indigo-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to project
      </Link>
    </div>
  );
}
