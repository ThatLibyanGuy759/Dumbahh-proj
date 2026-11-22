# LedgerLab – Accounting Workspace

LedgerLab is an intelligent accounting workspace built specifically for accounting assignments and professional bookkeeping. It combines an Excel-style formula spreadsheet engine with dedicated double-entry tools: **Chart of Accounts Manager**, **Smart Transaction Feeder (Auto-Journalizer)**, **General Journal**, **General Ledger**, **Trial Balance Generator**, **Financial Statement Builder**, and **Bank Reconciliation**.

---

## What's New: Auto-Generation Pipeline

You can now:
1. **Create Custom Accounts & Account Numbers**: Add accounts one by one or **Quick Paste** an entire chart of accounts (with account numbers and opening/beginning balances).
2. **Feed in Days of Transactions**: Paste raw daily transactions (e.g. *"June 4: Customer was invoiced $1900.00 for sale of stock to be paid within 30 days"*).
3. **Auto-Generate Everything**:
   - **General Journal**: Formatted double-entry journal with automatic debit/credit balancing.
   - **General Ledger**: T-account ledger for every account with opening balances, all period transactions, and running balances.
   - **Trial Balance**: Verification that Total Debits = Total Credits (with a toggle to exclude unused accounts).
   - **Income Statement**: Multi-step Revenues − Expenses = Net Income.
   - **Balance Sheet**: Assets = Liabilities + Owner's Equity (Beginning Capital + Net Income − Drawings = Ending Capital).

---

## Solved Assignment Example: Mr. Scarpelli's Repair Services

The database is pre-loaded with the exact problem from your assignment:

### 1. Chart of Accounts & May Opening Balances:
- `100 Cash`: $1,300.00 Dr
- `101 Accounts Receivable`: $1,400.00 Dr
- `102 Supplies`: $300.00 Dr
- `103 Land`: $93,000.00 Dr
- `104 Building`: $104,000.00 Dr
- `105 Equipment`: $11,400.00 Dr
- `200 Accounts Payable`: $2,100.00 Cr
- `201 Bank Loan`: $10,100.00 Cr
- `202 Mortgage`: $165,000.00 Cr
- `300 Mr. Scarpelli, Capital`: $34,200.00 Cr
- `301 Mr. Scarpelli, Drawings`: $0.00
- `400 Sales`: $0.00
- `401 Fees Earned`: $0.00
- `500 Salaries Expense`: $0.00
- `501 Advertising Expense`: $0.00
- `502 Delivery Expense`: $0.00
- `503 Hydro Expense`: $0.00
- `504 Water Expense`: $0.00
- `505 Miscellaneous Expense`: $0.00

### 2. June Transactions & Auto-Generated Entries:
1. **June 4**: Invoiced customer $1,900 for sale of stock (net 30)  
   $\rightarrow$ Debit **101 Accounts Receivable** $1,900.00 | Credit **400 Sales** $1,900.00
2. **June 7**: Paid $160 for water expense  
   $\rightarrow$ Debit **504 Water Expense** $160.00 | Credit **100 Cash** $160.00
3. **June 8**: Paid $290 for advertising expense  
   $\rightarrow$ Debit **501 Advertising Expense** $290.00 | Credit **100 Cash** $290.00
4. **June 10**: Paid $250 for salaries expense  
   $\rightarrow$ Debit **500 Salaries Expense** $250.00 | Credit **100 Cash** $250.00
5. **June 12**: Bought $1,400 worth of supplies on credit  
   $\rightarrow$ Debit **102 Supplies** $1,400.00 | Credit **200 Accounts Payable** $1,400.00
6. **June 15**: $200 paid for advertising service  
   $\rightarrow$ Debit **501 Advertising Expense** $200.00 | Credit **100 Cash** $200.00
7. **June 17**: Traded in $1,000 of old equipment for store credit  
   $\rightarrow$ Debit **101 Accounts Receivable** $1,000.00 | Credit **105 Equipment** $1,000.00
8. **June 18**: $50 paid for advertising service  
   $\rightarrow$ Debit **501 Advertising Expense** $50.00 | Credit **100 Cash** $50.00
9. **June 21**: Returned $3,000 of old equipment for refund within 30 days  
   $\rightarrow$ Debit **101 Accounts Receivable** $3,000.00 | Credit **105 Equipment** $3,000.00
10. **June 22**: $230 paid for advertising service  
    $\rightarrow$ Debit **501 Advertising Expense** $230.00 | Credit **100 Cash** $230.00
11. **June 25**: Refunded $3,700 of equipment for cash  
    $\rightarrow$ Debit **100 Cash** $3,700.00 | Credit **105 Equipment** $3,700.00
12. **June 27**: Paid $220 for hydro expense  
    $\rightarrow$ Debit **503 Hydro Expense** $220.00 | Credit **100 Cash** $220.00

### 3. Ending Balances & Financial Reports:

#### **Trial Balance (June 30, 2025)**
*(Unused accounts 301, 401, 502, 505 excluded)*

| Account # | Account Title | Debit ($) | Credit ($) |
|---|---|---:|---:|
| 100 | Cash | $3,600.00 | |
| 101 | Accounts Receivable | $7,300.00 | |
| 102 | Supplies | $1,700.00 | |
| 103 | Land | $93,000.00 | |
| 104 | Building | $104,000.00 | |
| 105 | Equipment | $3,700.00 | |
| 200 | Accounts Payable | | $3,500.00 |
| 201 | Bank Loan | | $10,100.00 |
| 202 | Mortgage | | $165,000.00 |
| 300 | Mr. Scarpelli, Capital | | $34,200.00 |
| 400 | Sales | | $1,900.00 |
| 500 | Salaries Expense | $250.00 | |
| 501 | Advertising Expense | $770.00 | |
| 503 | Hydro Expense | $220.00 | |
| 504 | Water Expense | $160.00 | |
| **TOTAL** | | **$214,700.00** | **$214,700.00** |

**Status:** $\checkmark$ **BALANCED**

---

#### **Income Statement**
*For the Month Ended June 30, 2025*

- **Revenues**:
  - Sales: $1,900.00
  - **Total Revenues**: **$1,900.00**
- **Operating Expenses**:
  - Salaries Expense: $250.00
  - Advertising Expense: $770.00
  - Hydro Expense: $220.00
  - Water Expense: $160.00
  - **Total Operating Expenses**: **$1,400.00**
- **NET INCOME**: **$500.00**

---

#### **Balance Sheet**
*As of June 30, 2025*

- **Assets**:
  - Cash: $3,600.00
  - Accounts Receivable: $7,300.00
  - Supplies: $1,700.00
  - Land: $93,000.00
  - Building: $104,000.00
  - Equipment: $3,700.00
  - **Total Assets**: **$213,300.00**
- **Liabilities**:
  - Accounts Payable: $3,500.00
  - Bank Loan: $10,100.00
  - Mortgage: $165,000.00
  - **Total Liabilities**: **$178,600.00**
- **Owner's Equity**:
  - Beginning Capital: $34,200.00
  - Add: Net Income: $500.00
  - **Ending Capital**: **$34,700.00**
- **Total Liabilities & Owner's Equity**: **$213,300.00**

**Status:** $\checkmark$ **BALANCED ($A = L + E = \$213,300.00$)**

---

## How to Run Locally

Double click:
```bat
run_app.bat
```
- Backend runs on: `http://localhost:5000`
- Frontend runs on: `http://localhost:5173`
