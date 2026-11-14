import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService, money, today } from '../core/api.service';
import { ActionCfg, ColCfg, CrudCfg, FieldCfg, SelectSource } from '../core/crud.config';

interface Opt { value: any; label: string; }

/** View + controller for every list/form screen. Behaviour comes from the CrudCfg in route data. */
@Component({
  selector: 'app-crud',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  @if (cfg) {
    <div class="page-head">
      <h2>{{ cfg.title }}</h2>
      @if (cfg.fields.length) { <button class="btn primary" (click)="startNew()">New entry</button> }
    </div>
    @if (cfg.hint) { <p class="muted" style="margin-top:-8px">{{ cfg.hint }}</p> }
    @if (error) { <div class="error">{{ error }}</div> }

    @if (form) {
      <form class="panel form" (ngSubmit)="save()">
        @for (f of cfg.fields; track f.key) {
          @if (f.type === 'checkbox') {
            <label class="check"><input type="checkbox" [(ngModel)]="form[f.key]" [name]="f.key"> {{ f.label }}</label>
          } @else {
            <label>{{ f.label }}
              @if (f.type === 'select') {
                <select [(ngModel)]="form[f.key]" [name]="f.key" [required]="!!f.required">
                  <option [ngValue]="null">Select...</option>
                  @for (o of opts[f.key] || []; track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
                </select>
              } @else {
                <input [type]="f.type" [(ngModel)]="form[f.key]" [name]="f.key" [required]="!!f.required" [attr.step]="f.type === 'number' ? 'any' : null">
              }
            </label>
          }
        }
        <div class="actions">
          <button class="btn primary" type="submit">{{ editingId ? 'Save changes' : 'Save' }}</button>
          <button class="btn" type="button" (click)="form = null">Cancel</button>
        </div>
      </form>
    }

    @if (!rows.length) {
      <div class="empty">Nothing here yet.{{ cfg.fields.length ? ' Use "New entry" to add the first record.' : '' }}</div>
    } @else {
      <div class="table-wrap">
        <table>
          <thead><tr>
            @for (c of cfg.columns; track c.label) { <th [class.num]="c.type === 'money'">{{ c.label }}</th> }
            <th></th>
          </tr></thead>
          <tbody>
            @for (r of rows; track r.id) {
              <tr>
                @for (c of cfg.columns; track c.label) { <td [class.num]="c.type === 'money'">{{ cell(r, c) }}</td> }
                <td class="row-actions">
                  @for (a of cfg.actions || []; track a.label) {
                    @if (a.show(r)) { <button class="btn small" (click)="run(a, r)">{{ a.label }}</button> }
                  }
                  @if (!cfg.immutable) {
                    <button class="btn small" (click)="startEdit(r)">Edit</button>
                    @if (!(cfg.protect && cfg.protect(r))) { <button class="btn small danger" (click)="remove(r)">Delete</button> }
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  }`
})
export class CrudComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  /** When set (e.g. inside the admin panel) it is used instead of the route data. */
  @Input() config?: CrudCfg;
  cfg!: CrudCfg;
  rows: any[] = [];
  form: any = null;
  editingId: number | null = null;
  opts: Record<string, Opt[]> = {};
  error = '';

  ngOnInit() {
    if (this.config) { this.init(this.config); return; }
    this.route.data.subscribe(d => this.init(d['cfg']));
  }

  private init(cfg: CrudCfg) {
    this.cfg = cfg;
    this.form = null; this.error = '';
    this.load();
    this.loadLookups();
  }

  load() {
    this.api.list(this.cfg.resource).subscribe({ next: r => this.rows = r, error: e => this.error = ApiService.message(e) });
  }

  private loadLookups() {
    const sources = [...new Set(this.cfg.fields.map(f => (f.options as SelectSource)?.source).filter((x): x is string => !!x))];
    const calls: Record<string, any> = {};
    sources.forEach(s => calls[s] = this.api.list(s));
    this.opts = {};
    this.cfg.fields.forEach(f => {   // static option lists
      if (Array.isArray(f.options)) this.opts[f.key] = f.options.map(o => ({ value: o, label: o }));
    });
    if (!sources.length) return;
    forkJoin(calls).subscribe({
      next: data => this.cfg.fields.forEach(f => {
        const o = f.options as SelectSource;
        if (o?.source) this.opts[f.key] = (data[o.source] as any[]).filter(o.filter ?? (() => true)).map(r => ({ value: r[o.value ?? 'id'], label: o.label(r) }));
      }),
      error: e => this.error = ApiService.message(e)
    });
  }

  startNew() {
    this.editingId = null; this.error = '';
    this.form = {};
    this.cfg.fields.forEach(f => this.form[f.key] = f.default ?? (f.type === 'date' ? (f.required ? today() : null) : f.type === 'number' ? 0 : null));
  }

  startEdit(r: any) {
    this.editingId = r.id; this.error = '';
    this.form = {};
    this.cfg.fields.forEach(f => this.form[f.key] = f.type === 'date' && r[f.key] ? String(r[f.key]).slice(0, 10) : r[f.key]);
  }

  save() {
    const body: any = {};   // send only the configured scalar fields, never nested objects
    this.cfg.fields.forEach((f: FieldCfg) => {
      let v = this.form[f.key];
      if (v === '' || v === undefined) v = null;
      if (f.type === 'number' && v === null) v = 0;
      body[f.key] = v;
    });
    const req = this.editingId
      ? this.api.update(this.cfg.resource, this.editingId, body)
      : this.api.create(this.cfg.resource, body);
    req.subscribe({ next: () => { this.form = null; this.error = ''; this.load(); }, error: e => this.error = ApiService.message(e) });
  }

  remove(r: any) {
    if (!confirm('Delete this record?')) return;
    this.api.remove(this.cfg.resource, r.id).subscribe({ next: () => this.load(), error: e => this.error = ApiService.message(e) });
  }

  run(a: ActionCfg, r: any) {
    const v = prompt(a.prompt, String(a.amount(r)));
    if (v === null) return;
    this.api.post(a.endpoint(r), { amount: Number(v), date: today() })
      .subscribe({ next: () => { this.error = ''; this.load(); }, error: e => this.error = ApiService.message(e) });
  }

  cell(r: any, c: ColCfg): string {
    const v = c.fn ? c.fn(r) : r[c.key!];
    if (v === null || v === undefined) return '';
    if (c.type === 'money') return money(v);
    if (c.type === 'date') return String(v).slice(0, 10);
    if (c.type === 'bool') return v ? 'Yes' : 'No';
    return String(v);
  }
}
