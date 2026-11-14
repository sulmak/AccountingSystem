import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root', standalone: true, imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
  <div class="shell">
    <nav>
      <div class="brand">Ledgerline</div>
      <a routerLink="dashboard" routerLinkActive="active">Dashboard</a>
      @for (g of groups; track g.title) {
        <div class="group">{{ g.title }}</div>
        @for (l of g.links; track l.path) { <a [routerLink]="l.path" routerLinkActive="active">{{ l.label }}</a> }
      }
      <div class="credit">Powered by<br>Md. Atikur Rahman Mridha</div>
    </nav>
    <main><router-outlet /></main>
  </div>`,
  styles: [`
    .shell { display: grid; grid-template-columns: 236px 1fr; min-height: 100vh; }
    nav { background: var(--ledger); color: #dbe7e0; padding: 20px 0 32px; position: sticky; top: 0; height: 100vh; overflow-y: auto; display: flex; flex-direction: column; }
    .credit { margin-top: auto; padding: 18px 22px 0; border-top: 1px solid rgba(255, 255, 255, .12); font-size: 11.5px; line-height: 1.5; color: #8fb0a2; }
    .brand { font-family: 'Source Serif 4', Georgia, serif; font-size: 22px; color: #fff; padding: 0 22px 14px; }
    .group { font-size: 12.5px; color: #8fb0a2; padding: 16px 22px 4px; font-weight: 600; }
    a { display: block; padding: 6px 22px; color: #dbe7e0; text-decoration: none; border-left: 3px solid transparent; }
    a:hover { background: var(--ledger-hi); }
    a.active { background: var(--ledger-hi); border-left-color: #d9a441; color: #fff; }
    main { padding: 28px 36px 60px; min-width: 0; max-width: 1280px; }
    @media (max-width: 820px) { .shell { grid-template-columns: 1fr; } nav { position: static; height: auto; } main { padding: 20px 16px; } }
  `]
})
export class AppComponent {
  groups = [
    { title: 'Master data', links: [
      { path: 'materials', label: 'Material master' },
      { path: 'articles', label: 'Article master' }, { path: 'customers', label: 'Customers' }, { path: 'vendors', label: 'Vendors' }] },
    { title: 'Inventory', links: [{ path: 'inventory', label: 'Material inventory' }] },
    { title: 'Transactions', links: [
      { path: 'sales', label: 'Sales' }, { path: 'incomes', label: 'Income' },
      { path: 'expenses', label: 'Expenses' }, { path: 'liabilities', label: 'Liabilities' }] },
    { title: 'Payables and receivables', links: [
      { path: 'payables', label: 'Accounts payable' }, { path: 'receivables', label: 'Accounts receivable' }] },
    { title: 'Reports', links: [
      { path: 'income-statement', label: 'Income statement' }, { path: 'trial-balance', label: 'Trial balance' },
      { path: 'ledger', label: 'General ledger' }, { path: 'budget-activity', label: 'Budget activity' }] },
    { title: 'Administration', links: [{ path: 'admin', label: 'Admin panel' }] }
  ];
}
