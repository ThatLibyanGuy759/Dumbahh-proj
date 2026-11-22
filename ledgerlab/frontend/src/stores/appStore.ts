import { create } from "zustand";
import type { Assignment, Account, JournalEntry } from "@/types";
import { assignmentsApi, accountsApi, journalEntriesApi } from "@/lib/api";

interface AppState {
  // Assignments
  assignments: Assignment[];
  currentAssignment: Assignment | null;
  loadAssignments: () => Promise<void>;
  fetchAssignments: () => Promise<void>;
  loadAssignment: (id: number) => Promise<void>;
  createAssignment: (data: Partial<Assignment>) => Promise<Assignment>;
  updateAssignment: (id: number, data: Partial<Assignment>) => Promise<void>;
  deleteAssignment: (id: number) => Promise<void>;

  // Accounts
  accounts: Account[];
  loadAccounts: () => Promise<void>;
  fetchAccounts: () => Promise<void>;
  seedAccounts: () => Promise<void>;

  // Journal Entries
  journalEntries: JournalEntry[];
  loadJournalEntries: (assignmentId?: number) => Promise<void>;

  // UI State
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  setSaveStatus: (status: "idle" | "saving" | "saved" | "error") => void;
  activeView: "dashboard" | "spreadsheet" | "journal" | "ledger" | "trial-balance" | "reports" | "reconciliation";
  setActiveView: (view: AppState["activeView"]) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  assignments: [],
  currentAssignment: null,
  accounts: [],
  journalEntries: [],
  sidebarOpen: true,
  sidebarCollapsed: false,
  saveStatus: "idle",
  activeView: "dashboard",

  setSaveStatus: (status) => set({ saveStatus: status }),

  loadAssignments: async () => {
    const assignments = await assignmentsApi.list();
    set({ assignments });
  },
  fetchAssignments: async () => {
    const assignments = await assignmentsApi.list();
    set({ assignments });
  },

  loadAssignment: async (id: number) => {
    const assignment = await assignmentsApi.get(id);
    set({ currentAssignment: assignment });
  },

  createAssignment: async (data: Partial<Assignment>) => {
    const assignment = await assignmentsApi.create(data);
    set({ assignments: [assignment, ...get().assignments] });
    return assignment;
  },

  updateAssignment: async (id: number, data: Partial<Assignment>) => {
    const updated = await assignmentsApi.update(id, data);
    set({
      assignments: get().assignments.map((a) => (a.id === id ? updated : a)),
      currentAssignment: get().currentAssignment?.id === id ? updated : get().currentAssignment,
    });
  },

  deleteAssignment: async (id: number) => {
    await assignmentsApi.delete(id);
    set({
      assignments: get().assignments.filter((a) => a.id !== id),
      currentAssignment: get().currentAssignment?.id === id ? null : get().currentAssignment,
    });
  },

  loadAccounts: async () => {
    const accounts = await accountsApi.list();
    set({ accounts });
  },
  fetchAccounts: async () => {
    const accounts = await accountsApi.list();
    set({ accounts });
  },

  seedAccounts: async () => {
    await accountsApi.seed();
    await get().loadAccounts();
  },

  loadJournalEntries: async (assignmentId?: number) => {
    const entries = await journalEntriesApi.list(assignmentId);
    set({ journalEntries: entries });
  },

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    set({ sidebarCollapsed: next, sidebarOpen: !next });
  },
  setActiveView: (view) => set({ activeView: view }),
}));
