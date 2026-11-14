import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../core/api.service';
import { ExportService } from '../core/export.service';
import { ReportDoc, ReportRow } from '../core/report.models';
import { Period, PeriodPickerComponent } from './period-picker.component';

@Component({
  selector: 'app-trial-balance', standalone: true, imports: [CommonModule, PeriodPickerComponent],
  template: `
  <div class="page-head"><h2>Trial balance</h2></div>
  <app-period-picker type="monthly" (periodChange)="onPeriod($event)">
    <button class="btn" [disabled]="!data || busy" (click)="download('pdf')">Download PDF</button>
    <button class="btn" [disabled]="!data || busy" (click)="download('xlsx')">Download Excel</button>
  </app-period-picker>
  @if (error) { <div class="error">{{ error }}</div> }
  @if (data) {
    @if (!data.rows.length) { <div class="empty">No journal activity up to the end of this period.</div> }
    @else {
      <div class="table-wrap"><table>
        <thead>
          <tr><th rowspan="2">Code</th><th rowspan="2">Account</th>
            <th class="num" colspan="2">Opening balance</th><th class="num" colspan="2">Movement in period</th><th class="num" colspan="2">Closing balance</th></tr>
          <tr><th class="num">Debit</th><th class="num">Credit</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Debit</th><th class="num">Credit</th></tr>
        </thead>
        <tbody>
          @for (r of data.rows; track r.code) {
            <tr><td>{{ r.code }}</td><td>{{ r.name }}</td>
              <td class="num">{{ r.openingDebit ? (r.openingDebit | number:'1.2-2') : '' }}</td><td class="num">{{ r.openingCredit ? (r.openingCredit | number:'1.2-2') : '' }}</td>
              <td class="num">{{ r.periodDebit ? (r.periodDebit | number:'1.2-2') : '' }}</td><td class="num">{{ r.periodCredit ? (r.periodCredit | number:'1.2-2') : '' }}</td>
              <td class="num">{{ r.debit ? (r.debit | number:'1.2-2') : '' }}</td><td class="num">{{ r.credit ? (r.credit | number:'1.2-2') : '' }}</td></tr>
          }
        </tbody>
        <tfoot><tr><td colspan="2">Total</td>
          <td class="num">{{ data.totalOpeningDebit | number:'1.2-2' }}</td><td class="num">{{ data.totalOpeningCredit | number:'1.2-2' }}</td>
          <td class="num">{{ data.totalPeriodDebit | number:'1.2-2' }}</td><td class="num">{{ data.totalPeriodCredit | number:'1.2-2' }}</td>
          <td class="num">{{ data.totalDebit | number:'1.2-2' }}</td><td class="num">{{ data.totalCredit | number:'1.2-2' }}</td></tr></tfoot>
      </table></div>
      <p [class]="balanced ? 'ok' : 'bad'">{{ balanced ? 'Debits equal credits. The books are in balance.' : 'Debits and credits differ. Review recent entries.' }}</p>
    }
  }`
})
export class TrialBalanceComponent {
  private api = inject(ApiService);
  private exporter = inject(ExportService);
  period!: Period; data: any; error = ''; busy = false;

  get balanced() { return this.data.totalDebit === this.data.totalCredit && this.data.totalPeriodDebit === this.data.totalPeriodCredit; }

  onPeriod(p: Period) {
    this.period = p;
    this.api.get('reports/trial-balance', { from: p.from, asOf: p.to })
      .subscribe({ next: d => { this.data = d; this.error = ''; }, error: e => this.error = ApiService.message(e) });
  }

  private doc(): ReportDoc {
    const d = this.data;
    const rows: ReportRow[] = d.rows.map((r: any) => ({
      cells: [r.code, r.name, r.openingDebit || null, r.openingCredit || null, r.periodDebit || null, r.periodCredit || null, r.debit || null, r.credit || null]
    }));
    rows.push({ kind: 'grand', cells: ['', 'Total', d.totalOpeningDebit, d.totalOpeningCredit, d.totalPeriodDebit, d.totalPeriodCredit, d.totalDebit, d.totalCredit] });
    const num = (header: string) => ({ header, align: 'right' as const });
    return {
      title: 'Trial Balance', period: `${this.period.label}: ${this.period.from} to ${this.period.to}`, landscape: true,
      columns: [{ header: 'Code' }, { header: 'Account' }, num('Opening Debit'), num('Opening Credit'), num('Movement Debit'), num('Movement Credit'), num('Closing Debit'), num('Closing Credit')],
      rows
    };
  }

  async download(kind: 'pdf' | 'xlsx') {
    this.busy = true; this.error = '';
    try { await this.exporter.download(this.doc(), kind, `trial-balance_${this.period.from}_to_${this.period.to}`); }
    catch (e: any) { this.error = 'Could not create the file: ' + (e?.message ?? e); }
    finally { this.busy = false; }
  }
}
