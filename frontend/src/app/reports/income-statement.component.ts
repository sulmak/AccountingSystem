import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../core/api.service';
import { ExportService } from '../core/export.service';
import { ReportDoc, ReportRow } from '../core/report.models';
import { Period, PeriodPickerComponent } from './period-picker.component';

@Component({
  selector: 'app-income-statement', standalone: true, imports: [CommonModule, PeriodPickerComponent],
  template: `
  <div class="page-head"><h2>Income statement</h2></div>
  <app-period-picker type="monthly" (periodChange)="onPeriod($event)">
    <button class="btn" [disabled]="!d || busy" (click)="download('pdf')">Download PDF</button>
    <button class="btn" [disabled]="!d || busy" (click)="download('xlsx')">Download Excel</button>
  </app-period-picker>
  @if (error) { <div class="error">{{ error }}</div> }
  @if (d) {
    <table>
      <tbody>
        <tr class="section-row"><td colspan="3">Revenue</td></tr>
        @for (r of d.revenue; track r.code) { <tr><td class="indent">{{ r.code }}</td><td>{{ r.name }}</td><td class="num">{{ r.amount | number:'1.2-2' }}</td></tr> }
        <tr class="total-row"><td colspan="2">Total revenue</td><td class="num">{{ d.totalRevenue | number:'1.2-2' }}</td></tr>

        <tr class="section-row"><td colspan="3">Cost of sales</td></tr>
        @for (r of d.costOfSales; track r.code) { <tr><td class="indent">{{ r.code }}</td><td>{{ r.name }}</td><td class="num">{{ r.amount | number:'1.2-2' }}</td></tr> }
        <tr class="total-row"><td colspan="2">Gross profit</td><td class="num">{{ d.grossProfit | number:'1.2-2' }}</td></tr>

        <tr class="section-row"><td colspan="3">Operating expenses</td></tr>
        @for (r of d.expenses; track r.code) { <tr><td class="indent">{{ r.code }}</td><td>{{ r.name }}</td><td class="num">{{ r.amount | number:'1.2-2' }}</td></tr> }
        <tr class="total-row"><td colspan="2">Total operating expenses</td><td class="num">{{ d.totalExpenses | number:'1.2-2' }}</td></tr>

        <tr class="grand-row"><td colspan="2">{{ d.netIncome >= 0 ? 'Net income' : 'Net loss' }}</td>
          <td class="num" [class.neg]="d.netIncome < 0">{{ d.netIncome | number:'1.2-2' }}</td></tr>
      </tbody>
    </table>
  }`
})
export class IncomeStatementComponent {
  private api = inject(ApiService);
  private exporter = inject(ExportService);
  period!: Period; d: any; error = ''; busy = false;

  onPeriod(p: Period) {
    this.period = p;
    this.api.get('reports/income-statement', { from: p.from, to: p.to })
      .subscribe({ next: d => { this.d = d; this.error = ''; }, error: e => this.error = ApiService.message(e) });
  }

  private doc(): ReportDoc {
    const d = this.d; const rows: ReportRow[] = [];
    const section = (t: string) => rows.push({ kind: 'section', cells: [t, null, null] });
    const items = (a: any[]) => a.forEach(r => rows.push({ cells: [r.code, r.name, r.amount] }));
    const total = (t: string, v: number, kind: 'total' | 'grand' = 'total') => rows.push({ kind, cells: ['', t, v] });
    section('Revenue'); items(d.revenue); total('Total revenue', d.totalRevenue);
    section('Cost of sales'); items(d.costOfSales); total('Gross profit', d.grossProfit);
    section('Operating expenses'); items(d.expenses); total('Total operating expenses', d.totalExpenses);
    total(d.netIncome >= 0 ? 'Net income' : 'Net loss', d.netIncome, 'grand');
    return {
      title: 'Income Statement', period: `${this.period.label}: ${this.period.from} to ${this.period.to}`,
      columns: [{ header: 'Code' }, { header: 'Account' }, { header: 'Amount', align: 'right' }], rows
    };
  }

  async download(kind: 'pdf' | 'xlsx') {
    this.busy = true; this.error = '';
    try { await this.exporter.download(this.doc(), kind, `income-statement_${this.period.from}_to_${this.period.to}`); }
    catch (e: any) { this.error = 'Could not create the file: ' + (e?.message ?? e); }
    finally { this.busy = false; }
  }
}
