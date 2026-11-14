import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ymd } from '../core/api.service';

export interface Period { from: string; to: string; label: string; }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const short = (d: Date) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;

/** Monthly / quarterly / half-yearly / yearly / custom period. Quarters and halves follow the fiscal year start in Admin > General settings. */
@Component({
  selector: 'app-period-picker', standalone: true, imports: [CommonModule, FormsModule],
  template: `
  <div class="panel toolbar">
    <label>Report period
      <select [(ngModel)]="type" (ngModelChange)="emit()">
        <option value="monthly">Monthly</option>
        <option value="quarterly">Quarterly</option>
        <option value="half">Half-yearly</option>
        <option value="yearly">Yearly</option>
        <option value="custom">Custom dates</option>
      </select>
    </label>
    @switch (type) {
      @case ('monthly') { <label>Month <input type="month" [(ngModel)]="month" (ngModelChange)="emit()"></label> }
      @case ('custom') {
        <label>From <input type="date" [(ngModel)]="from" (ngModelChange)="emit()"></label>
        <label>To <input type="date" [(ngModel)]="to" (ngModelChange)="emit()"></label>
      }
      @default {
        <label>{{ fsm === 1 ? 'Year' : 'Fiscal year (start)' }} <input type="number" [(ngModel)]="year" (ngModelChange)="emit()" style="width:100px"></label>
        @if (type === 'quarterly') {
          <label>Quarter
            <select [(ngModel)]="quarter" (ngModelChange)="emit()">
              @for (q of [1, 2, 3, 4]; track q) { <option [ngValue]="q">Q{{ q }}</option> }
            </select>
          </label>
        }
        @if (type === 'half') {
          <label>Half
            <select [(ngModel)]="half" (ngModelChange)="emit()">
              <option [ngValue]="1">H1 (first 6 months)</option><option [ngValue]="2">H2 (last 6 months)</option>
            </select>
          </label>
        }
      }
    }
    <ng-content />
  </div>
  @if (current.label) { <p class="period-label">Showing <b>{{ current.label }}</b> ({{ current.from }} to {{ current.to }})</p> }`
})
export class PeriodPickerComponent implements OnInit {
  private api = inject(ApiService);
  @Input() type: 'monthly' | 'quarterly' | 'half' | 'yearly' | 'custom' = 'monthly';
  @Output() periodChange = new EventEmitter<Period>();

  fsm = 1; year = new Date().getFullYear(); quarter = 1; half = 1;
  month = ''; from = ''; to = '';
  current: Period = { from: '', to: '', label: '' };

  ngOnInit() {
    this.api.get('settings').subscribe({
      next: (s: any) => { this.fsm = s.fiscalYearStartMonth || 1; this.defaults(); this.emit(); },
      error: () => { this.defaults(); this.emit(); }
    });
  }

  private defaults() {
    const t = new Date();
    this.year = t.getMonth() + 1 >= this.fsm ? t.getFullYear() : t.getFullYear() - 1;
    const sinceStart = (t.getMonth() - (this.fsm - 1) + 12) % 12;
    this.quarter = Math.floor(sinceStart / 3) + 1;
    this.half = Math.floor(sinceStart / 6) + 1;
    this.month = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    this.from = ymd(new Date(t.getFullYear(), 0, 1));
    this.to = ymd(t);
  }

  private fyName() { return this.fsm === 1 ? `${this.year}` : `FY ${this.year}-${String((this.year + 1) % 100).padStart(2, '0')}`; }

  private compute(): Period | null {
    const y = Number(this.year);
    const span = (months: number, offset: number): [Date, Date] =>
      [new Date(y, this.fsm - 1 + offset, 1), new Date(y, this.fsm - 1 + offset + months, 0)];
    const range = (s: Date, e: Date, label: string): Period => ({ from: ymd(s), to: ymd(e), label: `${label} (${short(s)} - ${short(e)})` });

    if (this.type === 'monthly') {
      const [yy, mm] = (this.month || '').split('-').map(Number);
      if (!yy || !mm) return null;
      return { from: ymd(new Date(yy, mm - 1, 1)), to: ymd(new Date(yy, mm, 0)), label: `${MONTHS[mm - 1]} ${yy}` };
    }
    if (this.type === 'custom') {
      if (!this.from || !this.to || this.from > this.to) return null;
      return { from: this.from, to: this.to, label: 'Custom period' };
    }
    if (!y || y < 1900 || y > 2200) return null;
    if (this.type === 'quarterly') { const [s, e] = span(3, (this.quarter - 1) * 3); return range(s, e, `Q${this.quarter} ${this.fyName()}`); }
    if (this.type === 'half') { const [s, e] = span(6, (this.half - 1) * 6); return range(s, e, `H${this.half} ${this.fyName()}`); }
    const [s, e] = span(12, 0);
    return range(s, e, this.fsm === 1 ? `Year ${this.year}` : this.fyName());
  }

  emit() {
    const p = this.compute();
    if (!p) return;
    this.current = p;
    this.periodChange.emit(p);
  }
}
