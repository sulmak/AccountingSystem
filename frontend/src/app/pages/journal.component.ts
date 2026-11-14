import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, today } from '../core/api.service';

@Component({
  selector: 'app-journal', standalone: true, imports: [CommonModule, FormsModule],
  template: `
  <div class="page-head"><h2>Journal entries</h2></div>
  <p class="muted" style="margin-top:-8px">Post manual double-entry adjustments. Sales, bills and payments are posted automatically.</p>
  @if (error) { <div class="error">{{ error }}</div> }

  <div class="panel">
    <div class="toolbar" style="margin-bottom:14px">
      <label>Date <input type="date" [(ngModel)]="date"></label>
      <label>Reference <input [(ngModel)]="reference" placeholder="Auto"></label>
      <label style="flex:1; min-width:220px">Description <input [(ngModel)]="description"></label>
    </div>
    <div class="line-grid head"><span>Account</span><span>Debit</span><span>Credit</span><span>Memo</span><span></span></div>
    @for (l of lines; track $index) {
      <div class="line-grid">
        <select [(ngModel)]="l.accountId">
          <option [ngValue]="null">Select...</option>
          @for (a of accounts; track a.id) { <option [ngValue]="a.id">{{ a.code }} - {{ a.name }}</option> }
        </select>
        <input type="number" step="any" [(ngModel)]="l.debit" (ngModelChange)="l.credit = l.debit ? 0 : l.credit">
        <input type="number" step="any" [(ngModel)]="l.credit" (ngModelChange)="l.debit = l.credit ? 0 : l.debit">
        <input [(ngModel)]="l.memo">
        <button class="btn small danger" (click)="lines.splice($index, 1)" [disabled]="lines.length <= 2">Remove</button>
      </div>
    }
    <div class="toolbar" style="margin-top:10px; justify-content:space-between">
      <button class="btn" (click)="addLine()">Add line</button>
      <span>Debit {{ totalDebit() | number:'1.2-2' }} / Credit {{ totalCredit() | number:'1.2-2' }}
        <b [class]="balanced() ? 'ok' : 'bad'">{{ balanced() ? 'Balanced' : 'Out of balance' }}</b></span>
      <button class="btn primary" [disabled]="!balanced()" (click)="post()">Post entry</button>
    </div>
  </div>

  <h3>Recent entries</h3>
  @if (!entries.length) { <div class="empty">No journal entries yet.</div> }
  @for (e of entries; track e.id) {
    <table style="margin-bottom:14px">
      <thead><tr><th colspan="3">{{ e.date | date:'yyyy-MM-dd' }} &nbsp; {{ e.reference }} &nbsp; <span class="muted">{{ e.source }}</span> &nbsp; {{ e.description }} @if (e.source !== 'Reversal') { &nbsp; <button class="btn small" (click)="reverse(e)">Reverse</button> }</th>
        <th class="num">Debit</th><th class="num">Credit</th></tr></thead>
      <tbody>
        @for (l of e.lines; track l.id) {
          <tr><td class="indent" colspan="3">{{ l.account?.code }} - {{ l.account?.name }}</td>
            <td class="num">{{ l.debit ? (l.debit | number:'1.2-2') : '' }}</td><td class="num">{{ l.credit ? (l.credit | number:'1.2-2') : '' }}</td></tr>
        }
      </tbody>
    </table>
  }`
})
export class JournalComponent implements OnInit {
  private api = inject(ApiService);
  accounts: any[] = []; entries: any[] = []; error = '';
  date = today(); reference = ''; description = '';
  lines: any[] = [this.blank(), this.blank()];

  ngOnInit() { this.api.list('accounts').subscribe(a => this.accounts = a.filter(x => x.isActive)); this.load(); }
  blank() { return { accountId: null, debit: 0, credit: 0, memo: '' }; }
  addLine() { this.lines.push(this.blank()); }
  totalDebit() { return this.lines.reduce((s, l) => s + (+l.debit || 0), 0); }
  totalCredit() { return this.lines.reduce((s, l) => s + (+l.credit || 0), 0); }
  balanced() { return this.totalDebit() > 0 && Math.abs(this.totalDebit() - this.totalCredit()) < 0.00001 && this.lines.every(l => !(+l.debit || +l.credit) || l.accountId); }
  load() { this.api.list('journal').subscribe({ next: e => this.entries = e, error: e => this.error = ApiService.message(e) }); }
  reverse(e: any) {
    if (!confirm(`Post a reversing entry for ${e.reference}? This reverses the ledger only, not the sale or bill behind it.`)) return;
    this.api.post(`journal/${e.id}/reverse`, {}).subscribe({ next: () => { this.error = ''; this.load(); }, error: x => this.error = ApiService.message(x) });
  }
  post() {
    const body = { date: this.date, reference: this.reference || null, description: this.description || null,
      lines: this.lines.filter(l => +l.debit || +l.credit).map(l => ({ accountId: l.accountId, debit: +l.debit || 0, credit: +l.credit || 0, memo: l.memo || null })) };
    this.api.create('journal', body).subscribe({
      next: () => { this.error = ''; this.reference = ''; this.description = ''; this.lines = [this.blank(), this.blank()]; this.load(); },
      error: e => this.error = ApiService.message(e)
    });
  }
}
