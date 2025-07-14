import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class XlsxDataService {
  private sheetData: string[][] = [];
  private fileName: string | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  setSheetData(data: string[][], fileName?: string) {
    this.sheetData = data;
    this.fileName = fileName || null;
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem('xlsxSheetData', JSON.stringify(data));
      sessionStorage.setItem('xlsxFileName', this.fileName || '');
    }
  }

  getSheetData(): string[][] {
    if (this.sheetData.length === 0 && isPlatformBrowser(this.platformId)) {
      const data = sessionStorage.getItem('xlsxSheetData');
      if (data) {
        this.sheetData = JSON.parse(data);
      }
    }
    return this.sheetData;
  }

  getFileName(): string | null {
    if (!this.fileName && isPlatformBrowser(this.platformId)) {
      this.fileName = sessionStorage.getItem('xlsxFileName');
    }
    return this.fileName;
  }

  clear() {
    this.sheetData = [];
    this.fileName = null;
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem('xlsxSheetData');
      sessionStorage.removeItem('xlsxFileName');
    }
  }
}
