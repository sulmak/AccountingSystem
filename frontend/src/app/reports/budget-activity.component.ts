import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-budget-activity', standalone: true, imports: [CommonModule, FormsModule],
  template: `
  <div class="page-head"><h2>Budget activity</h2></div>
  <p class="muted" style="margin-top:-8px">Budget compared with what was actually posted to revenue and expense accounts.</p>
  <div class="panel toolbar">
    <label>Year <input type="number" [(ngModel)]="year" style="width:100px"></label>
    <label>Month
      <select [(ngModel)]="month">
        <option [ngValue]="0">Whole year</option>
        @for (m of months; track m) { <option [ngValue]="m">{{ m }}</option> }
      </select>
    </label>
    <button class="btn primary" (click)="load()">Run report</button>
  </div>
  @if (error) { <div class="error">{{ error }}</div> }
  @if (d) {
    @if (!d.rows.length) { <div class="empty">No budgets or activity for this period.</div> }
    @else {
      <table>
        <thead><tr><th>Code</th><th>Account</th><th class="num">Budget</th><th class="num">Actual</th><th class="num">Variance</th><th class="num">% of budget</th></tr></thead>
        <tbody>
          @for (r of d.rows; track r.code) {
            <tr><td>{{ r.code }}</td><td>{{ r.name }}</td>
              <td class="num">{{ r.budget | number:'1.2-2' }}</td><td class="num">{{ r.actual | number:'1.2-2' }}</td>
              <td class="num" [class.neg]="over(r)">{{ r.variance | number:'1.2-2' }}</td>
              <td class="num">{{ r.percentUsed === null ? '-' : (r.percentUsed | number:'1.1-1') + '%' }}</td></tr>
          }
        </tbody>
      </table>
      <p class="muted">Variance is actual minus budget. Red means expenses above budget or revenue below budget.</p>
    }
  }`
})
export class BudgetActivityComponent implements OnInit {
  private api = inject(ApiService);
  year = new Date().getFullYear(); month = 0; d: any; error = '';
  months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  ngOnInit() { this.load(); }
  load() { this.api.get('reports/budget-activity', { year: this.year, month: this.month }).subscribe({ next: d => { this.d = d; this.error = ''; }, error: e => this.error = ApiService.message(e) }); }
  over(r: any) { return r.type === 'Expense' ? r.variance > 0 : r.type === 'Revenue' ? r.variance < 0 && r.budget > 0 : false; }
}
