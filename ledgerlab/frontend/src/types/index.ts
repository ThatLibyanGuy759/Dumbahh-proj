// ----- Spreadsheet Types -----

export interface CellData {
  id?: number;
  sheet_id?: number;
  row: number;
  col: number;
  raw_value: string;
  computed_value: string;
  data_type: "string" | "number" | "formula" | "boolean" | "date";
  format_type: "general" | "currency" | "percentage" | "number" | "date" | "text";
  decimal_places: number;
  font_bold: boolean;
  font_italic: boolean;
  font_size: number;
  font_color: string;
  bg_color: string;
  text_align: "left" | "center" | "right";
  border: string;
}

export interface SheetData {
  id: number;
  name: string;
  workbook_id: number;
  position: number;
  row_count: number;
  col_count: number;
  frozen_rows: number;
  frozen_cols: number;
  col_widths: Record<string, number>;
  row_heights: Record<string, number>;
  cells?: CellData[];
}

export interface WorkbookData {
  id: number;
  name: string;
  description: string;
  assignment_id: number | null;
  sheet_count: number;
  sheets?: SheetData[];
  created_at: string;
  updated_at: string;
}

// ----- Accounting Types -----

export interface Account {
  id: number;
  code: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
  normal_balance: "debit" | "credit";
  opening_balance: number;
  assignment_id: number | null;
  parent_id: number | null;
  description: string;
  is_active: boolean;
}

export interface JournalLine {
  id?: number;
  journal_entry_id?: number;
  line_number: number;
  account_id: number;
  account_name?: string;
  account_code?: string;
  debit: number;
  credit: number;
  description: string;
}

export interface JournalEntry {
  id: number;
  entry_number: string;
  date: string;
  description: string;
  reference: string;
  status: "draft" | "posted" | "void";
  assignment_id: number | null;
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
  lines: JournalLine[];
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  balance: number;
  reference: string;
  is_reconciled: boolean;
  matched_journal_line_id: number | null;
  assignment_id: number | null;
}

// ----- Assignment Types -----

export interface Assignment {
  id: number;
  name: string;
  description: string;
  course: string;
  status: "in_progress" | "completed" | "archived";
  due_date: string | null;
  created_at: string;
  updated_at: string;
  workbook_count: number;
  report_count: number;
  workbooks?: WorkbookData[];
  reports?: ReportData[];
}

// ----- Report Types -----

export interface ReportData {
  id: number;
  name: string;
  report_type: "income_statement" | "balance_sheet" | "cash_flow" | "trial_balance" | "custom";
  assignment_id: number | null;
  company_name: string;
  reporting_period: string;
  data: Record<string, unknown>;
  template: string;
  created_at: string;
  updated_at: string;
}

export interface TrialBalanceData {
  accounts: {
    account_code: string;
    account_name: string;
    account_type: string;
    debit: number;
    credit: number;
  }[];
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
}

export interface IncomeStatementData {
  revenues: { account_code: string; account_name: string; amount: number }[];
  expenses: { account_code: string; account_name: string; amount: number }[];
  total_revenue: number;
  total_expenses: number;
  net_income: number;
}

export interface BalanceSheetData {
  assets: { account_code: string; account_name: string; amount: number }[];
  liabilities: { account_code: string; account_name: string; amount: number }[];
  equity: { account_code: string; account_name: string; amount: number }[];
  net_income: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  is_balanced: boolean;
}

export interface LedgerData {
  account: Account;
  entries: {
    date: string;
    entry_number: string;
    description: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  ending_balance: number;
}

// ----- Selection -----

export interface CellPosition {
  row: number;
  col: number;
}

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
}
