import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, today } from '../core/api.service';

@Component({
  selector: 'app-inventory', standalone: true, imports: [CommonModule, FormsModule],
  template: `
  <div class="page-head"><h2>Inventory of material</h2><button class="btn primary" (click)="show = !show">Add opening stock</button></div>
  <p class="muted" style="margin-top:-8px">Stock rises with material purchases (accounts payable) and falls when articles are sold.</p>
  @if (error) { <div class="error">{{ error }}</div> }

  @if (show) {
    <form class="panel form" (ngSubmit)="save()">
      <label>Material
        <select [(ngModel)]="f.materialId" name="m" required>
          <option [ngValue]="null">Select...</option>
          @for (s of stock; track s.materialId) { <option [ngValue]="s.materialId">{{ s.code }} - {{ s.name }}</option> }
        </select>
      </label>
      <label>Quantity <input type="number" step="any" [(ngModel)]="f.quantity" name="q" required></label>
      <label>Unit cost <input type="number" step="any" [(ngModel)]="f.unitCost" name="c" required></label>
      <label>Date <input type="date" [(ngModel)]="f.date" name="d" required></label>
      <div class="actions"><button class="btn primary" type="submit">Save opening stock</button><button class="btn" type="button" (click)="show = false">Cancel</button></div>
    </form>
  }

  @if (!stock.length) { <div class="empty">No materials yet. Create them in the Material master first.</div> }
  @else {
    <table>
      <thead><tr><th>Code</th><th>Material</th><th>Unit</th><th class="num">On hand</th><th class="num">Unit cost</th><th class="num">Value</th><th>Status</th></tr></thead>
      <tbody>
        @for (s of stock; track s.materialId) {
          <tr><td>{{ s.code }}</td><td>{{ s.name }}</td><td>{{ s.unit }}</td>
            <td class="num">{{ s.onHand | number:'1.0-4' }}</td><td class="num">{{ s.unitCost | number:'1.2-4' }}</td><td class="num">{{ s.value | number:'1.2-2' }}</td>
            <td [class]="s.lowStock ? 'bad' : 'ok'">{{ s.lowStock ? 'Reorder' : 'OK' }}</td></tr>
        }
      </tbody>
      <tfoot><tr><td colspan="5">Total inventory value</td><td class="num">{{ total() | number:'1.2-2' }}</td><td></td></tr></tfoot>
    </table>
  }

  <h3>Stock movements</h3>
  @if (!moves.length) { <div class="empty">No stock movements yet.</div> }
  @else {
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Material</th><th>Type</th><th>Reference</th><th class="num">Quantity</th><th class="num">Unit cost</th></tr></thead>
      <tbody>
        @for (m of moves; track m.id) {
          <tr><td>{{ m.date | date:'yyyy-MM-dd' }}</td><td>{{ m.material?.name }}</td><td>{{ m.type }}</td><td>{{ m.reference }}</td>
            <td class="num" [class.neg]="m.quantity < 0">{{ m.quantity | number:'1.0-4' }}</td><td class="num">{{ m.unitCost | number:'1.2-4' }}</td></tr>
        }
      </tbody>
    </table></div>
  }`
})
export class InventoryComponent implements OnInit {
  private api = inject(ApiService);
  stock: any[] = []; moves: any[] = []; error = ''; show = false;
  f: any = { materialId: null, quantity: 0, unitCost: 0, date: today() };

  ngOnInit() { this.load(); }
  total() { return this.stock.reduce((s, r) => s + r.value, 0); }
  load() {
    this.api.get<any[]>('inventory/stock').subscribe({ next: s => this.stock = s, error: e => this.error = ApiService.message(e) });
    this.api.get<any[]>('inventory/transactions').subscribe(m => this.moves = m);
  }
  save() {
    this.api.post('inventory/opening', this.f).subscribe({
      next: () => { this.show = false; this.error = ''; this.f = { materialId: null, quantity: 0, unitCost: 0, date: today() }; this.load(); },
      error: e => this.error = ApiService.message(e)
    });
  }
}
