import { Routes } from '@angular/router';
import { CFG } from './core/crud.config';
import { CrudComponent } from './pages/crud.component';
import { DashboardComponent } from './pages/dashboard.component';
import { AdminComponent } from './pages/admin.component';
import { JournalComponent } from './pages/journal.component';
import { InventoryComponent } from './pages/inventory.component';
import { LedgerComponent } from './reports/ledger.component';
import { BudgetActivityComponent } from './reports/budget-activity.component';
import { TrialBalanceComponent } from './reports/trial-balance.component';
import { IncomeStatementComponent } from './reports/income-statement.component';

const crud = (path: string) => ({ path, component: CrudComponent, data: { cfg: CFG[path] } });

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'admin', component: AdminComponent },
  crud('accounts'), crud('materials'), crud('articles'), crud('customers'), crud('vendors'),
  { path: 'journal', component: JournalComponent },
  { path: 'ledger', component: LedgerComponent },
  crud('budgets'),
  { path: 'budget-activity', component: BudgetActivityComponent },
  { path: 'inventory', component: InventoryComponent },
  crud('sales'), crud('incomes'), crud('expenses'), crud('liabilities'),
  crud('payables'), crud('receivables'),
  { path: 'income-statement', component: IncomeStatementComponent },
  { path: 'trial-balance', component: TrialBalanceComponent },
  { path: '**', redirectTo: 'dashboard' }
];
