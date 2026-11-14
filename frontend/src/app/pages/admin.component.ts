import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { CFG } from '../core/crud.config';
import { CrudComponent } from './crud.component';
import { JournalComponent } from './journal.component';
import { LedgerComponent } from '../reports/ledger.component';
import { BudgetActivityComponent } from '../reports/budget-activity.component';

/** Admin panel: configuration of settings, chart of accounts, general ledger, budgets and activity. */
@Component({
  selector: 'app-admin', standalone: true,
  imports: [CommonModule, FormsModule, CrudComponent, JournalComponent, LedgerComponent, BudgetActivityComponent],
  template: `
  <div class="page-head"><h2>Admin panel</h2></div>
  <div class="tabs" role="tablist">
    @for (t of tabs; track t.id) { <button role="tab" [class.active]="tab === t.id" (click)="tab = t.id">{{ t.label }}</button> }
  </div>

  @switch (tab) {
    @case ('settings') {
      <p class="muted" style="margin-top:-8px">Company details, fiscal year and period close.</p>
      @if (msg) { <div [class]="msgOk ? 'panel ok' : 'error'">{{ msg }}</div> }
      @if (s) {
        <form class="panel form" (ngSubmit)="saveSettings()">
          <label>Company name <input [(ngModel)]="s.companyName" name="c" required></label>
          <label>Currency symbol <input [(ngModel)]="s.currency" name="cur" maxlength="10"></label>
          <label>Fiscal year starts in
            <select [(ngModel)]="s.fiscalYearStartMonth" name="fy">
              @for (m of months; track m.n) { <option [ngValue]="m.n">{{ m.name }}</option> }
            </select>
          </label>
          <label>Close books through (optional)
            <input type="date" [(ngModel)]="s.lockedThrough" name="lock">
          </label>
          <p class="muted" style="grid-column:1/-1; margin:0">Nothing can be posted on or before the close date, including by sales, bills and payments. Clear the date to reopen the period.</p>
          <div class="actions">
            <button class="btn primary" type="submit">Save settings</button>
            <button class="btn" type="button" (click)="s.lockedThrough = null">Clear close date</button>
          </div>
        </form>
      }
    }
    @case ('accounts') { <app-crud [config]="accountsCfg" /> }
    @case ('gl') {
      <div class="subtabs">
        <button class="btn" [class.active]="gl === 'entries'" (click)="gl = 'entries'">Post and reverse entries</button>
        <button class="btn" [class.active]="gl === 'ledger'" (click)="gl = 'ledger'">Account ledger</button>
      </div>
      @if (gl === 'entries') { <app-journal /> } @else { <app-ledger /> }
    }
    @case ('budgets') {
      @if (fillMsg) { <div [class]="fillOk ? 'panel ok' : 'error'">{{ fillMsg }}</div> }
      <form class="panel toolbar" (ngSubmit)="fillYear()">
        <label>Fill a whole year for
          <select [(ngModel)]="fill.accountId" name="a" required>
            <option [ngValue]="null">Select account...</option>
            @for (a of budgetAccounts; track a.id) { <option [ngValue]="a.id">{{ a.code }} - {{ a.name }}</option> }
          </select>
        </label>
        <label>Year <input type="number" [(ngModel)]="fill.year" name="y" style="width:100px"></label>
        <label>Amount per month <input type="number" step="any" [(ngModel)]="fill.amount" name="m" style="width:150px"></label>
        <button class="btn primary" type="submit">Apply to 12 months</button>
      </form>
      <app-crud #budgets [config]="budgetsCfg" />
    }
    @case ('activity') { <app-budget-activity /> }
  }`
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  @ViewChild('budgets') budgets?: CrudComponent;

  tabs = [
    { id: 'settings', label: 'General settings' }, { id: 'accounts', label: 'Chart of accounts' },
    { id: 'gl', label: 'General ledger' }, { id: 'budgets', label: 'Budgets' }, { id: 'activity', label: 'Budget activity' }
  ];
  tab = 'settings'; gl = 'entries';
  accountsCfg = CFG['accounts']; budgetsCfg = CFG['budgets'];
  months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((name, i) => ({ n: i + 1, name }));

  s: any; msg = ''; msgOk = true;
  budgetAccounts: any[] = [];
  fill: any = { accountId: null, year: new Date().getFullYear(), amount: 0 }; fillMsg = ''; fillOk = true;

  ngOnInit() {
    this.api.get('settings').subscribe({
      next: s => this.s = { ...s, lockedThrough: s.lockedThrough ? String(s.lockedThrough).slice(0, 10) : null },
      error: e => { this.msg = ApiService.message(e); this.msgOk = false; }
    });
    this.api.list('accounts').subscribe(a => this.budgetAccounts = a.filter(x => x.isActive && (x.type === 'Revenue' || x.type === 'Expense')));
  }

  saveSettings() {
    this.api.put('settings', { ...this.s, lockedThrough: this.s.lockedThrough || null }).subscribe({
      next: () => { this.msg = 'Settings saved.'; this.msgOk = true; },
      error: e => { this.msg = ApiService.message(e); this.msgOk = false; }
    });
  }

  fillYear() {
    this.api.post('budgets/fill-year', { accountId: this.fill.accountId, year: +this.fill.year, amount: +this.fill.amount || 0 }).subscribe({
      next: () => { this.fillMsg = 'Budget applied to all 12 months.'; this.fillOk = true; this.budgets?.load(); },
      error: e => { this.fillMsg = ApiService.message(e); this.fillOk = false; }
    });
  }
}
