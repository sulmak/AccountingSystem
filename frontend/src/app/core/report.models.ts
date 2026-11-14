/** A neutral description of a report; ExportService turns it into a PDF or an Excel file. */
export interface ReportColumn { header: string; align?: 'left' | 'right'; }
export interface ReportRow {
  cells: (string | number | null)[];
  kind?: 'section' | 'total' | 'grand' | 'opening';
}
export interface ReportDoc {
  title: string;
  period: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  landscape?: boolean;
}
