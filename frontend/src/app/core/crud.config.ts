/** Describes one master/transaction screen. The generic CrudComponent renders any of these. */
export interface SelectSource { source: string; value?: string; label: (r: any) => string; filter?: (r: any) => boolean; }
export interface FieldCfg {
  key: string; label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  required?: boolean; default?: any;
  options?: string[] | SelectSource;
}
export interface ColCfg { label: string; key?: string; fn?: (r: any) => any; type?: 'money' | 'date' | 'bool' | 'text'; }
export interface ActionCfg { label: string; prompt: string; endpoint: (r: any) => string; show: (r: any) => boolean; amount: (r: any) => number; }
export interface CrudCfg {
  title: string; resource: string; fields: FieldCfg[]; columns: ColCfg[];
  protect?: (r: any) => boolean;   // rows that must not show a Delete button
  immutable?: boolean;       // posted transactions: no edit / delete (reverse with a journal entry instead)
  actions?: ActionCfg[];
  hint?: string;
}

const acct = (types: string[]): SelectSource => ({
  source: 'accounts', label: r => `${r.code} - ${r.name}`, filter: r => r.isActive && (!types.length || types.includes(r.type))
});

export const CFG: Record<string, CrudCfg> = {
  accounts: {
    title: 'Chart of accounts', resource: 'accounts', protect: r => r.isSystem,
    hint: 'Accounts marked System are used by automatic postings. You can rename them but not delete, retype or deactivate them.',
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'select', required: true, default: 'Asset', options: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] },
      { key: 'isActive', label: 'Active', type: 'checkbox', default: true }
    ],
    columns: [{ label: 'Code', key: 'code' }, { label: 'Name', key: 'name' }, { label: 'Type', key: 'type' }, { label: 'Active', key: 'isActive', type: 'bool' }, { label: 'System', key: 'isSystem', type: 'bool' }]
  },
  materials: {
    title: 'Material master', resource: 'materials',
    hint: 'Unit cost is maintained automatically (moving average) when stock is received.',
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'unit', label: 'Unit', type: 'text', default: 'pcs' },
      { key: 'unitCost', label: 'Unit cost', type: 'number', default: 0 },
      { key: 'reorderLevel', label: 'Reorder level', type: 'number', default: 0 }
    ],
    columns: [{ label: 'Code', key: 'code' }, { label: 'Name', key: 'name' }, { label: 'Unit', key: 'unit' },
      { label: 'Unit cost', key: 'unitCost', type: 'money' }, { label: 'Reorder level', key: 'reorderLevel', type: 'money' }]
  },
  articles: {
    title: 'Article master', resource: 'articles',
    hint: 'Each article is made from one material. Selling an article issues material from stock.',
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'materialId', label: 'Material', type: 'select', required: true, options: { source: 'materials', label: r => `${r.code} - ${r.name}` } },
      { key: 'materialQtyPerUnit', label: 'Material used per unit', type: 'number', default: 1 },
      { key: 'salePrice', label: 'Sale price', type: 'number', default: 0 }
    ],
    columns: [{ label: 'Code', key: 'code' }, { label: 'Name', key: 'name' },
      { label: 'Material', fn: r => r.material ? `${r.material.code} - ${r.material.name}` : '' },
      { label: 'Qty per unit', key: 'materialQtyPerUnit', type: 'money' }, { label: 'Sale price', key: 'salePrice', type: 'money' }]
  },
  customers: {
    title: 'Customers', resource: 'customers',
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'phone', label: 'Phone', type: 'text' }, { key: 'email', label: 'Email', type: 'text' }],
    columns: [{ label: 'Name', key: 'name' }, { label: 'Phone', key: 'phone' }, { label: 'Email', key: 'email' }]
  },
  vendors: {
    title: 'Vendors', resource: 'vendors',
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'phone', label: 'Phone', type: 'text' }, { key: 'email', label: 'Email', type: 'text' }],
    columns: [{ label: 'Name', key: 'name' }, { label: 'Phone', key: 'phone' }, { label: 'Email', key: 'email' }]
  },
  budgets: {
    title: 'Budgets', resource: 'budgets',
    hint: 'One budget amount per account per month.',
    fields: [
      { key: 'accountId', label: 'Account', type: 'select', required: true, options: acct(['Revenue', 'Expense']) },
      { key: 'year', label: 'Year', type: 'number', required: true, default: new Date().getFullYear() },
      { key: 'month', label: 'Month (1-12)', type: 'number', required: true, default: new Date().getMonth() + 1 },
      { key: 'amount', label: 'Amount', type: 'number', required: true, default: 0 }
    ],
    columns: [{ label: 'Account', fn: r => r.account ? `${r.account.code} - ${r.account.name}` : '' },
      { label: 'Year', key: 'year' }, { label: 'Month', key: 'month' }, { label: 'Amount', key: 'amount', type: 'money' }]
  },
  sales: {
    title: 'Sales', resource: 'sales', immutable: true,
    hint: 'Posts revenue, cost of goods sold and the stock issue. Any unpaid part becomes a receivable. Unit price 0 uses the article price.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'customerId', label: 'Customer', type: 'select', options: { source: 'customers', label: r => r.name } },
      { key: 'articleId', label: 'Article', type: 'select', required: true, options: { source: 'articles', label: r => `${r.code} - ${r.name}` } },
      { key: 'quantity', label: 'Quantity', type: 'number', required: true, default: 1 },
      { key: 'unitPrice', label: 'Unit price', type: 'number', default: 0 },
      { key: 'paidAmount', label: 'Paid now', type: 'number', default: 0 }
    ],
    columns: [{ label: 'Invoice', key: 'invoiceNo' }, { label: 'Date', key: 'date', type: 'date' },
      { label: 'Customer', fn: r => r.customer?.name ?? 'Walk-in' }, { label: 'Article', fn: r => r.article?.name },
      { label: 'Qty', key: 'quantity', type: 'money' }, { label: 'Total', key: 'total', type: 'money' },
      { label: 'Paid', key: 'paidAmount', type: 'money' }, { label: 'Balance', key: 'balance', type: 'money' }]
  },
  incomes: {
    title: 'Income entries', resource: 'incomes', immutable: true,
    hint: 'Money received outside of sales. Debits cash, credits the revenue account.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'accountId', label: 'Revenue account', type: 'select', required: true, options: acct(['Revenue']) },
      { key: 'amount', label: 'Amount', type: 'number', required: true, default: 0 },
      { key: 'description', label: 'Description', type: 'text' }
    ],
    columns: [{ label: 'Date', key: 'date', type: 'date' }, { label: 'Account', fn: r => r.account?.name },
      { label: 'Description', key: 'description' }, { label: 'Amount', key: 'amount', type: 'money' }]
  },
  expenses: {
    title: 'Expense entries', resource: 'expenses', immutable: true,
    hint: 'Expenses paid from cash. Debits the expense account, credits cash.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'accountId', label: 'Expense account', type: 'select', required: true, options: acct(['Expense']) },
      { key: 'amount', label: 'Amount', type: 'number', required: true, default: 0 },
      { key: 'description', label: 'Description', type: 'text' }
    ],
    columns: [{ label: 'Date', key: 'date', type: 'date' }, { label: 'Account', fn: r => r.account?.name },
      { label: 'Description', key: 'description' }, { label: 'Amount', key: 'amount', type: 'money' }]
  },
  liabilities: {
    title: 'Liabilities', resource: 'liabilities', immutable: true,
    hint: 'Loans and other borrowings. Cash received is debited; the liability account is credited.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'lender', label: 'Lender', type: 'text', required: true },
      { key: 'accountId', label: 'Liability account', type: 'select', required: true, options: acct(['Liability']) },
      { key: 'amount', label: 'Amount', type: 'number', required: true, default: 0 },
      { key: 'dueDate', label: 'Due date', type: 'date' }
    ],
    columns: [{ label: 'Date', key: 'date', type: 'date' }, { label: 'Lender', key: 'lender' }, { label: 'Account', fn: r => r.account?.name },
      { label: 'Due', key: 'dueDate', type: 'date' }, { label: 'Amount', key: 'amount', type: 'money' },
      { label: 'Repaid', key: 'paidAmount', type: 'money' }, { label: 'Balance', key: 'balance', type: 'money' }],
    actions: [{ label: 'Repay', prompt: 'Repayment amount', endpoint: r => `liabilities/${r.id}/repay`, show: r => r.balance > 0, amount: r => r.balance }]
  },
  payables: {
    title: 'Accounts payable', resource: 'payables', immutable: true,
    hint: 'Vendor bills. Choose a material to receive it into stock, or leave it empty and pick an expense account.',
    fields: [
      { key: 'billNo', label: 'Bill no. (optional)', type: 'text' },
      { key: 'date', label: 'Bill date', type: 'date', required: true },
      { key: 'dueDate', label: 'Due date', type: 'date' },
      { key: 'vendorId', label: 'Vendor', type: 'select', required: true, options: { source: 'vendors', label: r => r.name } },
      { key: 'materialId', label: 'Material (optional)', type: 'select', options: { source: 'materials', label: r => `${r.code} - ${r.name}` } },
      { key: 'quantity', label: 'Quantity (for material)', type: 'number', default: 0 },
      { key: 'expenseAccountId', label: 'Expense account (if no material)', type: 'select', options: acct(['Expense']) },
      { key: 'amount', label: 'Bill amount', type: 'number', required: true, default: 0 },
      { key: 'description', label: 'Description', type: 'text' }
    ],
    columns: [{ label: 'Bill', key: 'billNo' }, { label: 'Date', key: 'date', type: 'date' }, { label: 'Due', key: 'dueDate', type: 'date' },
      { label: 'Vendor', fn: r => r.vendor?.name }, { label: 'Material', fn: r => r.material?.name ?? '' },
      { label: 'Amount', key: 'amount', type: 'money' }, { label: 'Paid', key: 'paidAmount', type: 'money' }, { label: 'Balance', key: 'balance', type: 'money' }],
    actions: [{ label: 'Pay', prompt: 'Payment amount', endpoint: r => `payables/${r.id}/pay`, show: r => r.balance > 0, amount: r => r.balance }]
  },
  receivables: {
    title: 'Accounts receivable', resource: 'receivables', immutable: true,
    hint: 'Sales that are not fully paid. New receivables come from the Sales screen.',
    fields: [],
    columns: [{ label: 'Invoice', key: 'invoiceNo' }, { label: 'Date', key: 'date', type: 'date' },
      { label: 'Customer', fn: r => r.customer?.name ?? '' }, { label: 'Total', key: 'total', type: 'money' },
      { label: 'Received', key: 'paidAmount', type: 'money' }, { label: 'Balance', key: 'balance', type: 'money' }],
    actions: [{ label: 'Receive', prompt: 'Amount received', endpoint: r => `receivables/${r.id}/receive`, show: r => r.balance > 0, amount: r => r.balance }]
  }
};
