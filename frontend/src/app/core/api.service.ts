import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

type Params = Record<string, string | number | boolean>;

/** Thin wrapper around HttpClient; every call goes to the ASP.NET Core controllers under /api. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api';

  list<T = any>(resource: string, params: Params = {}) { return this.http.get<T[]>(`${this.base}/${resource}`, { params }); }
  get<T = any>(path: string, params: Params = {}) { return this.http.get<T>(`${this.base}/${path}`, { params }); }
  create(resource: string, body: any) { return this.http.post<any>(`${this.base}/${resource}`, body); }
  update(resource: string, id: number, body: any) { return this.http.put(`${this.base}/${resource}/${id}`, body); }
  remove(resource: string, id: number) { return this.http.delete(`${this.base}/${resource}/${id}`); }
  put(path: string, body: any) { return this.http.put(`${this.base}/${path}`, body); }
  post(path: string, body: any) { return this.http.post<any>(`${this.base}/${path}`, body); }

  static message(e: any): string {
    const b = e?.error;
    if (b?.errors) return (Object.values(b.errors).flat() as string[]).join(' ');
    return b?.title || (e?.status === 0 ? 'Cannot reach the API. Is the backend running on port 5080?' : e?.message) || 'Request failed.';
  }
}

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ymd(new Date());
export const money = (v: any) => (v === null || v === undefined || v === '') ? '' :
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
