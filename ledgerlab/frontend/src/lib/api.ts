const API_BASE = "/api";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ----- Assignments -----
export const assignmentsApi = {
  list: () => fetchJSON<any[]>("/assignments"),
  get: (id: string | number) => fetchJSON<any>(`/assignments/${id}`),
  create: (data: any) => fetchJSON<any>("/assignments", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string | number, data: any) => fetchJSON<any>(`/assignments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string | number) => fetchJSON<any>(`/assignments/${id}`, { method: "DELETE" }),
};

export const getAssignments = assignmentsApi.list;
export const getAssignment = assignmentsApi.get;
export const createAssignment = assignmentsApi.create;
export const updateAssignment = assignmentsApi.update;
export const deleteAssignment = assignmentsApi.delete;

// ----- Accounts (Chart of Accounts) -----
export const accountsApi = {
  list: (assignmentId?: string | number) =>
    fetchJSON<any[]>(`/accounts${assignmentId ? `?assignment_id=${assignmentId}` : ""}`),
  get: (id: string | number) => fetchJSON<any>(`/accounts/${id}`),
  create: (data: any) => fetchJSON<any>("/accounts", { method: "POST", body: JSON.stringify(data) }),
  bulk: (data: { assignment_id?: number | null; replace?: boolean; accounts: any[] }) =>
    fetchJSON<any[]>("/accounts/bulk", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string | number, data: any) => fetchJSON<any>(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string | number, force = false) =>
    fetchJSON<any>(`/accounts/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),
  bulkDelete: (data: { account_ids?: (string | number)[]; all?: boolean; assignment_id?: number | null; force?: boolean }) =>
    fetchJSON<{ message: string; deleted_count: number }>("/accounts/bulk-delete", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  seed: (assignmentId?: number) =>
    fetchJSON<any>(`/accounts/seed${assignmentId ? `?assignment_id=${assignmentId}` : ""}`, { method: "POST" }),
  getLedger: (id: string | number) => fetchJSON<any>(`/accounts/${id}/ledger`),
  getAllLedgers: (assignmentId?: string | number, hideUnused = true) =>
    fetchJSON<any[]>(`/accounts/ledgers/all?hide_unused=${hideUnused}${assignmentId ? `&assignment_id=${assignmentId}` : ""}`),
};

export const getAccounts = accountsApi.list;
export const getAccount = accountsApi.get;
export const createAccount = accountsApi.create;
export const bulkAccounts = accountsApi.bulk;
export const updateAccount = accountsApi.update;
export const deleteAccount = accountsApi.delete;
export const bulkDeleteAccounts = accountsApi.bulkDelete;
export const seedAccounts = accountsApi.seed;
export const getAccountLedger = accountsApi.getLedger;
export const getAllLedgers = accountsApi.getAllLedgers;

// ----- Workbooks & Sheets -----
export const workbooksApi = {
  list: (assignmentId?: string | number) => fetchJSON<any[]>(`/workbooks${assignmentId ? `?assignment_id=${assignmentId}` : ""}`),
  get: (id: string | number) => fetchJSON<any>(`/workbooks/${id}`),
  create: (data: any) => fetchJSON<any>("/workbooks", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string | number, data: any) => fetchJSON<any>(`/workbooks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string | number) => fetchJSON<any>(`/workbooks/${id}`, { method: "DELETE" }),
};

export const sheetsApi = {
  get: (id: string | number) => fetchJSON<any>(`/sheets/${id}`),
  create: (data: any) => fetchJSON<any>("/sheets", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string | number, data: any) => fetchJSON<any>(`/sheets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string | number) => fetchJSON<any>(`/sheets/${id}`, { method: "DELETE" }),
  getCells: (sheetId: string | number) => fetchJSON<any[]>(`/sheets/${sheetId}/cells`),
  updateCells: (sheetId: string | number, cells: any[]) =>
    fetchJSON<any[]>(`/sheets/${sheetId}/cells`, { method: "PUT", body: JSON.stringify({ cells }) }),
  clearCells: (sheetId: string | number, cells: { row: number; col: number }[]) =>
    fetchJSON<any>(`/sheets/${sheetId}/cells/clear`, { method: "POST", body: JSON.stringify({ cells }) }),
};

// ----- Journal Entries & Auto-Parser -----
export const journalEntriesApi = {
  list: (assignmentId?: string | number) =>
    fetchJSON<any[]>(`/journal-entries${assignmentId ? `?assignment_id=${assignmentId}` : ""}`),
  get: (id: string | number) => fetchJSON<any>(`/journal-entries/${id}`),
  create: (data: any) => fetchJSON<any>("/journal-entries", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string | number, data: any) =>
    fetchJSON<any>(`/journal-entries/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string | number) => fetchJSON<any>(`/journal-entries/${id}`, { method: "DELETE" }),
  post: (id: string | number) => fetchJSON<any>(`/journal-entries/${id}/post`, { method: "POST" }),
  autoParse: (text: string, assignmentId?: number | null, defaultYear = 2025) =>
    fetchJSON<{ parsed_count: number; entries: any[] }>("/journal-entries/auto-parse", {
      method: "POST",
      body: JSON.stringify({ text, assignment_id: assignmentId, default_year: defaultYear }),
    }),
  bulkCreate: (entries: any[], assignmentId?: number | null, post = true) =>
    fetchJSON<any[]>("/journal-entries/bulk-create", {
      method: "POST",
      body: JSON.stringify({ entries, assignment_id: assignmentId, post }),
    }),
  getGeneralJournal: (assignmentId?: string | number) =>
    fetchJSON<{ entries: any[]; total_entries: number; total_debits: number; total_credits: number }>(
      `/journal-entries/general-journal${assignmentId ? `?assignment_id=${assignmentId}` : ""}`
    ),
  clear: (assignmentId?: string | number) =>
    fetchJSON<any>("/journal-entries/clear", {
      method: "POST",
      body: JSON.stringify({ assignment_id: assignmentId }),
    }),
};

export const getJournalEntries = journalEntriesApi.list;
export const getJournalEntry = journalEntriesApi.get;
export const createJournalEntry = journalEntriesApi.create;
export const updateJournalEntry = journalEntriesApi.update;
export const deleteJournalEntry = journalEntriesApi.delete;
export const postJournalEntry = journalEntriesApi.post;
export const autoParseTransactions = journalEntriesApi.autoParse;
export const bulkCreateJournalEntries = journalEntriesApi.bulkCreate;
export const getGeneralJournal = journalEntriesApi.getGeneralJournal;

// ----- Reports (Trial Balance, Income Statement, Balance Sheet) -----
export const reportsApi = {
  list: (assignmentId?: string | number) =>
    fetchJSON<any[]>(`/reports${assignmentId ? `?assignment_id=${assignmentId}` : ""}`),
  get: (id: string | number) => fetchJSON<any>(`/reports/${id}`),
  create: (data: any) => fetchJSON<any>("/reports", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string | number, data: any) => fetchJSON<any>(`/reports/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string | number) => fetchJSON<any>(`/reports/${id}`, { method: "DELETE" }),
  generateTrialBalance: (assignmentId?: string | number, hideUnused = true) =>
    fetchJSON<any>(`/reports/generate/trial-balance?hide_unused=${hideUnused}${assignmentId ? `&assignment_id=${assignmentId}` : ""}`),
  generateIncomeStatement: (assignmentId?: string | number, hideUnused = true) =>
    fetchJSON<any>(`/reports/generate/income-statement?hide_unused=${hideUnused}${assignmentId ? `&assignment_id=${assignmentId}` : ""}`),
  generateBalanceSheet: (assignmentId?: string | number, hideUnused = true) =>
    fetchJSON<any>(`/reports/generate/balance-sheet?hide_unused=${hideUnused}${assignmentId ? `&assignment_id=${assignmentId}` : ""}`),
};

// ----- Bank Transactions -----
export const bankTransactionsApi = {
  list: (assignmentId?: string | number) =>
    fetchJSON<any[]>(`/bank-transactions${assignmentId ? `?assignment_id=${assignmentId}` : ""}`),
  create: (data: any) => fetchJSON<any>("/bank-transactions", { method: "POST", body: JSON.stringify(data) }),
  batchCreate: (data: any) => fetchJSON<any[]>("/bank-transactions/batch", { method: "POST", body: JSON.stringify(data) }),
  reconcile: (id: string | number, data: any) =>
    fetchJSON<any>(`/bank-transactions/${id}/reconcile`, { method: "POST", body: JSON.stringify(data) }),
  unreconcile: (id: string | number) =>
    fetchJSON<any>(`/bank-transactions/${id}/unreconcile`, { method: "POST" }),
  delete: (id: string | number) => fetchJSON<any>(`/bank-transactions/${id}`, { method: "DELETE" }),
  summary: (assignmentId?: string | number) =>
    fetchJSON<any>(`/bank-transactions/summary${assignmentId ? `?assignment_id=${assignmentId}` : ""}`),
};

export const getBankTransactions = bankTransactionsApi.list;
export const createBankTransaction = bankTransactionsApi.create;
export const reconcileBankTransaction = bankTransactionsApi.reconcile;
export const unreconcileBankTransaction = bankTransactionsApi.unreconcile;
export const deleteBankTransaction = bankTransactionsApi.delete;
export const getBankSummary = bankTransactionsApi.summary;
