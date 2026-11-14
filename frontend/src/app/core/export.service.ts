import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ReportDoc } from './report.models';

interface Meta { company: string; currency: string; }

@Injectable({ providedIn: 'root' })
export class ExportService {
  private api = inject(ApiService);

  async download(doc: ReportDoc, kind: 'pdf' | 'xlsx', fileBase: string) {
    const s: any = await firstValueFrom(this.api.get('settings'));
    const meta: Meta = { company: s.companyName, currency: s.currency };
    const name = `${fileBase}.${kind}`;
    if (kind === 'pdf') await this.pdf(doc, meta, name); else await this.excel(doc, meta, name);
  }

  private fmt(v: string | number | null | undefined): string {
    if (typeof v === 'number') return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v ?? '';
  }

  // ---------------- PDF ----------------
  private async pdf(doc: ReportDoc, meta: Meta, file: string) {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const pdf = new jsPDF({ orientation: doc.landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const margin = 40;

    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text(meta.company, margin, 46);
    pdf.setFontSize(13); pdf.text(doc.title, margin, 66);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(90);
    pdf.text(doc.period, margin, 82);
    pdf.text(`Amounts in ${meta.currency}`, width - margin, 46, { align: 'right' });
    pdf.text(`Generated ${new Date().toLocaleString()}`, width - margin, 62, { align: 'right' });
    pdf.setTextColor(0);

    const n = doc.columns.length;
    const body = doc.rows.map(r => r.kind === 'section'
      ? [{ content: String(r.cells[0] ?? ''), colSpan: n }]
      : doc.columns.map((_, i) => this.fmt(r.cells[i])));
    const columnStyles: Record<number, any> = {};
    doc.columns.forEach((c, i) => { if (c.align === 'right') columnStyles[i] = { halign: 'right' }; });

    autoTable(pdf, {
      startY: 96, margin: { left: margin, right: margin, bottom: 44 },
      head: [doc.columns.map(c => c.header)], body: body as any, theme: 'grid', columnStyles,
      styles: { fontSize: 9, cellPadding: 4, lineColor: [213, 220, 210], lineWidth: 0.4, textColor: [27, 42, 35] },
      headStyles: { fillColor: [31, 61, 51], textColor: 255, fontStyle: 'bold' },
      didParseCell: (d: any) => {
        if (d.section === 'head' && doc.columns[d.column.index]?.align === 'right') d.cell.styles.halign = 'right';
        if (d.section !== 'body') return;
        const kind = doc.rows[d.row.index]?.kind;
        if (kind === 'section') { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [233, 237, 229]; }
        else if (kind === 'total' || kind === 'opening') { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [245, 247, 242]; }
        else if (kind === 'grand') { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fontSize = 10.5; d.cell.styles.fillColor = [225, 231, 220]; }
      }
    });

    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i); pdf.setFontSize(9); pdf.setTextColor(110);
      pdf.text(`Page ${i} of ${pages}`, width - margin, height - 20, { align: 'right' });
      pdf.text(meta.company, margin, height - 20);
    }
    pdf.save(file);
  }

  // ---------------- Excel ----------------
  private async excel(doc: ReportDoc, meta: Meta, file: string) {
    const mod: any = await import('exceljs');
    const ExcelJS = mod.default ?? mod;
    const wb = new ExcelJS.Workbook();
    wb.creator = meta.company;
    const ws = wb.addWorksheet(doc.title.slice(0, 31), {
      pageSetup: { orientation: doc.landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    ws.addRow([meta.company]).font = { bold: true, size: 14 };
    ws.addRow([doc.title]).font = { bold: true, size: 12 };
    ws.addRow([doc.period]);
    ws.addRow([`Amounts in ${meta.currency}`]).font = { color: { argb: 'FF5E6D65' } };
    ws.addRow([]);

    const head = ws.addRow(doc.columns.map(c => c.header));
    head.eachCell((cell: any, i: number) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3D33' } };
      cell.alignment = { horizontal: doc.columns[i - 1].align === 'right' ? 'right' : 'left' };
    });
    ws.views = [{ state: 'frozen', ySplit: head.number }];

    const widths = doc.columns.map(c => c.header.length);
    for (const r of doc.rows) {
      const row = ws.addRow(doc.columns.map((_, i) => r.cells[i] ?? null));
      r.cells.forEach((v, i) => { if (!(r.kind === 'section' && i === 0)) widths[i] = Math.max(widths[i], this.fmt(v).length); });
      row.eachCell({ includeEmpty: true }, (cell: any, i: number) => {
        if (typeof cell.value === 'number') cell.numFmt = '#,##0.00;[Red]-#,##0.00';
        if (doc.columns[i - 1]?.align === 'right') cell.alignment = { horizontal: 'right' };
        if (r.kind === 'section') { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9EDE5' } }; }
        if (r.kind === 'total' || r.kind === 'opening') { cell.font = { bold: true }; cell.border = { top: { style: 'thin' } }; }
        if (r.kind === 'grand') { cell.font = { bold: true, size: 12 }; cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } }; }
      });
    }
    widths.forEach((w, i) => ws.getColumn(i + 1).width = Math.min(50, Math.max(11, w + 3)));

    const buffer = await wb.xlsx.writeBuffer();
    this.save(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), file);
  }

  private save(blob: Blob, file: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = file;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
