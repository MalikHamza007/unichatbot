import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpHeaders, HttpResponse } from "@angular/common/http";
import { Observable, take, retry, Subject } from "rxjs";

@Injectable({
  providedIn: 'root',
})
export class ApiCallService {
   protected apiURL: string = 'http://127.0.0.1:8000/api'
  protected http: HttpClient = inject(HttpClient);
  protected httpOptions: { headers: HttpHeaders } = {
    headers: new HttpHeaders({
    })
  };
  protected getHttpOptions: { headers: HttpHeaders } = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };
   protected jsonToFormData(data: any, formData: FormData = new FormData(), parentKey: string | null = null): FormData {
    if (data && typeof data === 'object' && !(data instanceof Date) && !(data instanceof File)) {
      Object.keys(data).forEach(key => {
        const value = data[key];
        const formKey = parentKey ? `${parentKey}[${key}]` : key;
  
        if (Array.isArray(value)) {
          value.forEach((val, index) => {
            const arrayKey = `${formKey}[${index}]`;
            if (typeof val === 'object' && val !== null) {
              this.jsonToFormData(val, formData, arrayKey);
            } else {
              formData.append(arrayKey, val);
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          this.jsonToFormData(value, formData, formKey);
        } else {
          formData.append(formKey, value);
        }
      });
    } else {
      formData.append(parentKey!, data);
    }
    return formData;
  }

  get<T>(url: string, params?: Record<string, string>): Observable<T> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.http.get<T>(`${this.apiURL}${url}${queryString}`, this.getHttpOptions);
  }

  post<T>(url: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.apiURL}${url}`, body, this.getHttpOptions);
  }

  delete<T>(url: string, params?: Record<string, string>): Observable<T> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.http.delete<T>(`${this.apiURL}${url}${queryString}`, this.getHttpOptions);
  }
}

