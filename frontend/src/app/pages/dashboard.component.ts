import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, money } from '../core/api.service';

@Component({
  selector: 'app-dashboard', standalone: true, imports: [CommonModule, RouterLink],
  template: `
  @if (error) { <div class="error">{{ error }}</div> }
  @if (d) {
    <header class="head">
      <div>
        <h2>{{ d.company }}</h2>
        <p class="muted">Position as of {{ d.asOf | date:'d MMMM yyyy' }}. Fiscal year began {{ d.yearStart | date:'d MMM yyyy' }}. Amounts in {{ d.currency }}.</p>
      </div>
      @if (d.lockedThrough) { <span class="lock">Books closed through {{ d.lockedThrough | date:'d MMM yyyy' }}</span> }
    </header>

    <section class="position">
      @for (p of position; track p.label) {
        <div class="pos">
          <span class="pos-label">{{ p.label }}</span>
          <span class="pos-value" [class.neg]="p.value < 0">{{ fmt(p.value) }}</span>
          <a [routerLink]="p.link" class="pos-link">{{ p.linkLabel }}</a>
        </div>
      }
    </section>

    <div class="grid">
      <section class="panel results">
        <h3>Results</h3>
        <table>
          <thead><tr><th></th><th class="num">This month</th><th class="num">Fiscal year to date</th></tr></thead>
          <tbody>
            <tr><td>Revenue</td><td class="num">{{ fmt(d.month.revenue) }}</td><td class="num">{{ fmt(d.year.revenue) }}</td></tr>
            <tr><td>Expenses</td><td class="num">{{ fmt(d.month.expenses) }}</td><td class="num">{{ fmt(d.year.expenses) }}</td></tr>
          </tbody>
          <tfoot><tr><td>Net income</td>
            <td class="num" [class.neg]="d.month.net < 0">{{ fmt(d.month.net) }}</td>
            <td class="num" [class.neg]="d.year.net < 0">{{ fmt(d.year.net) }}</td></tr></tfoot>
        </table>
      </section>

      <section class="panel chart">
        <h3>Last six months</h3>
        <svg viewBox="0 0 640 215" role="img" aria-label="Revenue and expenses by month">
          <line x1="0" y1="180" x2="640" y2="180" stroke="var(--rule)"/>
          @for (b of bars; track b.label) {
            <rect [attr.x]="b.rx" [attr.y]="b.ry" [attr.width]="b.w" [attr.height]="b.rh" fill="var(--ledger-hi)"><title>{{ b.label }} revenue {{ fmt(b.revenue) }}</title></rect>
            <rect [attr.x]="b.ex" [attr.y]="b.ey" [attr.width]="b.w" [attr.height]="b.eh" fill="var(--brass)"><title>{{ b.label }} expenses {{ fmt(b.expenses) }}</title></rect>
            <text [attr.x]="b.cx" y="200" text-anchor="middle" font-size="12" fill="var(--muted)">{{ b.label }}</text>
          }
        </svg>
        <div class="legend"><span><i style="background:var(--ledger-hi)"></i>Revenue</span><span><i style="background:var(--brass)"></i>Expenses</span></div>
      </section>
    </div>

    <div class="grid three">
      <section class="panel">
        <h3>Needs attention</h3>
        <ul class="alerts">
          <li [class.clear]="!d.alerts.overdueBills.count">
            <b>{{ d.alerts.overdueBills.count }}</b> overdue {{ d.alerts.overdueBills.count === 1 ? 'bill' : 'bills' }}
            @if (d.alerts.overdueBills.count) { <span>({{ fmt(d.alerts.overdueBills.amount) }})</span> }
            <a routerLink="/payables">Open payables</a>
          </li>
          <li [class.clear]="!d.alerts.oldReceivables.count">
            <b>{{ d.alerts.oldReceivables.count }}</b> {{ d.alerts.oldReceivables.count === 1 ? 'invoice' : 'invoices' }} unpaid after 30 days
            @if (d.alerts.oldReceivables.count) { <span>({{ fmt(d.alerts.oldReceivables.amount) }})</span> }
            <a routerLink="/receivables">Open receivables</a>
          </li>
          <li [class.clear]="!d.alerts.lowStock.length">
            <b>{{ d.alerts.lowStock.length }}</b> {{ d.alerts.lowStock.length === 1 ? 'material' : 'materials' }} at or below reorder level
            <a routerLink="/inventory">Open inventory</a>
          </li>
        </ul>
        @for (m of d.alerts.lowStock; track m.name) { <p class="small muted">{{ m.name }}: {{ m.onHand | number:'1.0-2' }} {{ m.unit }} left (reorder at {{ m.reorder | number:'1.0-2' }})</p> }
      </section>

      <section class="panel">
        <h3>Budget this month</h3>
        @for (b of budgetBars; track b.label) {
          <div class="bar-row">
            <div class="bar-head"><span>{{ b.label }}</span><span>{{ fmt(b.actual) }} of {{ fmt(b.budget) }}</span></div>
            <div class="track"><div class="fill" [class.over]="b.over" [style.width.%]="b.pct"></div></div>
            <p class="small muted">{{ b.budget ? (b.rawPct | number:'1.0-0') + '% of budget' : 'No budget set' }}</p>
          </div>
        }
        <a routerLink="/admin" class="small">Set budgets in the admin panel</a>
      </section>

      <section class="panel">
        <h3>Largest expenses this month</h3>
        @if (!d.topExpenses.length) { <p class="muted">No expenses posted this month.</p> }
        @for (t of d.topExpenses; track t.name) {
          <div class="bar-row">
            <div class="bar-head"><span>{{ t.name }}</span><span>{{ fmt(t.amount) }}</span></div>
            <div class="track"><div class="fill brass" [style.width.%]="t.amount / topMax * 100"></div></div>
          </div>
        }
      </section>
    </div>

    <section class="panel">
      <h3 style="margin-top:0">Recent ledger activity</h3>
      @if (!d.recent.length) { <p class="muted">No journal entries yet. Record a sale, an expense or a manual entry to get started.</p> }
      @else {
        <table>
          <thead><tr><th>Date</th><th>Reference</th><th>Source</th><th>Description</th><th class="num">Amount</th></tr></thead>
          <tbody>
            @for (r of d.recent; track r.id) {
              <tr><td>{{ r.date | date:'yyyy-MM-dd' }}</td><td>{{ r.reference }}</td><td>{{ r.source }}</td><td>{{ r.description }}</td><td class="num">{{ fmt(r.amount) }}</td></tr>
            }
          </tbody>
        </table>
      }
    </section>
  }`,
  styles: [`
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
    .head p { margin: 4px 0 0; }
    .lock { border: 1px solid var(--brass); color: var(--brass-hi); padding: 4px 10px; border-radius: 3px; font-size: 13px; white-space: nowrap; }
    .position { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); background: var(--surface); border: 1px solid var(--rule); border-top: 3px solid var(--ledger); margin-bottom: 22px; }
    .pos { padding: 16px 18px; border-right: 1px solid var(--rule); display: flex; flex-direction: column; gap: 2px; }
    .pos:last-child { border-right: 0; }
    .pos-label { color: var(--muted); font-size: 13px; }
    .pos-value { font-family: 'Source Serif 4', Georgia, serif; font-size: 27px; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
    .pos-link { font-size: 12.5px; color: var(--ledger-hi); text-decoration: none; margin-top: 4px; }
    .pos-link:hover { text-decoration: underline; }
    .grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 18px; margin-bottom: 0; }
    .grid.three { grid-template-columns: repeat(3, 1fr); }
    @media (max-width: 1000px) { .grid, .grid.three { grid-template-columns: 1fr; } }
    .panel h3 { margin-top: 0; }
    .chart svg { width: 100%; height: auto; display: block; }
    .legend { display: flex; gap: 18px; font-size: 13px; color: var(--muted); }
    .legend i { display: inline-block; width: 10px; height: 10px; margin-right: 6px; }
    .alerts { list-style: none; margin: 0 0 8px; padding: 0; }
    .alerts li { padding: 8px 0; border-bottom: 1px solid var(--rule); display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
    .alerts li b { color: var(--bad); font-size: 16px; }
    .alerts li.clear b { color: var(--ok); }
    .alerts a, .panel a.small { margin-left: auto; font-size: 13px; color: var(--ledger-hi); }
    .small { font-size: 12.5px; margin: 4px 0; }
    .bar-row { margin-bottom: 12px; }
    .bar-head { display: flex; justify-content: space-between; gap: 8px; font-size: 13.5px; }
    .track { height: 8px; background: #e3e8df; margin-top: 4px; }
    .fill { height: 100%; background: var(--ledger-hi); }
    .fill.brass { background: var(--brass); }
    .fill.over { background: var(--bad); }
    .results table { border: 0; }
  `]
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  d: any; error = '';
  fmt = money;

  ngOnInit() { this.api.get('dashboard').subscribe({ next: d => this.d = d, error: e => this.error = ApiService.message(e) }); }

  get position() {
    const p = this.d.position;
    return [
      { label: 'Cash and bank', value: p.cash, link: '/trial-balance', linkLabel: 'Trial balance' },
      { label: 'Receivables', value: p.receivables, link: '/receivables', linkLabel: 'Who owes you' },
      { label: 'Inventory', value: p.inventory, link: '/inventory', linkLabel: 'Stock on hand' },
      { label: 'Payables', value: p.payables, link: '/payables', linkLabel: 'What you owe' },
      { label: 'Loans and other liabilities', value: p.loans, link: '/liabilities', linkLabel: 'Liabilities' }
    ];
  }

  get topMax() { return Math.max(1, ...this.d.topExpenses.map((t: any) => t.amount)); }

  get budgetBars() {
    const mk = (label: string, x: any, expense: boolean) => {
      const raw = x.budget ? x.actual / x.budget * 100 : 0;
      return { label, budget: x.budget, actual: x.actual, rawPct: raw, pct: Math.min(100, Math.max(0, raw)), over: expense && raw > 100 };
    };
    return [mk('Revenue', this.d.budget.revenue, false), mk('Expenses', this.d.budget.expenses, true)];
  }

  get bars() {
    const s: any[] = this.d.series;
    const max = Math.max(1, ...s.flatMap(x => [x.revenue, x.expenses]));
    const gw = 640 / s.length, w = gw * 0.26, scale = 165 / max;
    return s.map((x, i) => {
      const cx = i * gw + gw / 2;
      const rh = Math.max(0, x.revenue) * scale, eh = Math.max(0, x.expenses) * scale;
      return { label: x.label, revenue: x.revenue, expenses: x.expenses, cx, w, rx: cx - w - 2, ex: cx + 2, rh, eh, ry: 180 - rh, ey: 180 - eh };
    });
  }
}
