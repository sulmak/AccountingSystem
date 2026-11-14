import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { ExportService } from '../core/export.service';
import { ReportDoc, ReportRow } from '../core/report.models';
import { Period, PeriodPickerComponent } from './period-picker.component';

@Component({
  selector: 'app-ledger', standalone: true, imports: [CommonModule, FormsModule, PeriodPickerComponent],
  template: `
  <div class="page-head"><h2>General ledger</h2></div>
  <app-period-picker type="yearly" (periodChange)="onPeriod($event)">
    <label>Account
      <select [(ngModel)]="accountId" (ngModelChange)="load()">
        <option [ngValue]="null">All accounts</option>
        @for (a of accounts; track a.id) { <option [ngValue]="a.id">{{ a.code }} - {{ a.name }}</option> }
      </select>
    </label>
    <button class="btn" [disabled]="!d || busy" (click)="download('pdf')">Download PDF</button>
    <button class="btn" [disabled]="!d || busy" (click)="download('xlsx')">Download Excel</button>
  </app-period-picker>
  @if (error) { <div class="error">{{ error }}</div> }
  @if (d) {
    @if (!d.accounts.length) { <div class="empty">No ledger activity in this period.</div> }
    @for (a of d.accounts; track a.id) {
      <h3>{{ a.code }} - {{ a.name }} <span class="muted" style="font-size:13px; font-family:inherit">{{ a.type }}</span></h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th>Source</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
        <tbody>
          <tr class="section-row"><td colspan="6">Opening balance</td><td class="num">{{ bal(a.opening) }}</td></tr>
          @for (r of a.rows; track $index) {
            <tr><td>{{ r.date | date:'yyyy-MM-dd' }}</td><td>{{ r.reference }}</td><td>{{ r.description }}</td><td>{{ r.source }}</td>
              <td class="num">{{ r.debit ? (r.debit | number:'1.2-2') : '' }}</td>
              <td class="num">{{ r.credit ? (r.credit | number:'1.2-2') : '' }}</td>
              <td class="num">{{ bal(r.balance) }}</td></tr>
          }
        </tbody>
        <tfoot><tr><td colspan="4">Closing balance</td><td class="num">{{ a.totalDebit | number:'1.2-2' }}</td><td class="num">{{ a.totalCredit | number:'1.2-2' }}</td><td class="num">{{ bal(a.closing) }}</td></tr></tfoot>
      </table></div>
    }
    <p class="muted">Balances show Dr (debit) or Cr (credit).</p>
  }`
})
export class LedgerComponent implements OnInit {
  private api = inject(ApiService);
  private exporter = inject(ExportService);
  accounts: any[] = []; accountId: number | null = null;
  period?: Period; d: any; error = ''; busy = false;

  ngOnInit() { this.api.list('accounts').subscribe(a => this.accounts = a); }

  onPeriod(p: Period) { this.period = p; this.load(); }

  load() {
    if (!this.period) return;
    const params: Record<string, string | number> = { from: this.period.from, to: this.period.to };
    if (this.accountId) params['accountId'] = this.accountId;
    this.api.get('reports/general-ledger', params)
      .subscribe({ next: d => { this.d = d; this.error = ''; }, error: e => this.error = ApiService.message(e) });
  }

  bal(v: number) {
    const s = Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v === 0 ? s : `${s} ${v > 0 ? 'Dr' : 'Cr'}`;
  }
  private dc(v: number) { return v === 0 ? '' : v > 0 ? 'Dr' : 'Cr'; }

  private doc(): ReportDoc {
    const rows: ReportRow[] = [];
    for (const a of this.d.accounts) {
      rows.push({ kind: 'section', cells: [`${a.code} - ${a.name} (${a.type})`] });
      rows.push({ kind: 'opening', cells: ['', '', 'Opening balance', null, null, Math.abs(a.opening), this.dc(a.opening)] });
      for (const r of a.rows) {
        rows.push({ cells: [String(r.date).slice(0, 10), r.reference ?? '', r.description ?? '', r.debit || null, r.credit || null, Math.abs(r.balance), this.dc(r.balance)] });
      }
      rows.push({ kind: 'total', cells: ['', '', 'Closing balance', a.totalDebit, a.totalCredit, Math.abs(a.closing), this.dc(a.closing)] });
    }
    const num = (header: string) => ({ header, align: 'right' as const });
    const who = this.accountId ? this.accounts.find(x => x.id === this.accountId) : null;
    return {
      title: who ? `General Ledger: ${who.code} - ${who.name}` : 'General Ledger: all accounts',
      period: `${this.period!.label}: ${this.period!.from} to ${this.period!.to}`, landscape: true,
      columns: [{ header: 'Date' }, { header: 'Reference' }, { header: 'Description' }, num('Debit'), num('Credit'), num('Balance'), { header: 'Dr/Cr' }],
      rows
    };
  }

  async download(kind: 'pdf' | 'xlsx') {
    this.busy = true; this.error = '';
    try {
      const who = this.accountId ? this.accounts.find(x => x.id === this.accountId)?.code : 'all-accounts';
      await this.exporter.download(this.doc(), kind, `general-ledger_${who}_${this.period!.from}_to_${this.period!.to}`);
    } catch (e: any) { this.error = 'Could not create the file: ' + (e?.message ?? e); }
    finally { this.busy = false; }
  }
}
