import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class XlsxDataService {
  private sheetData: string[][] = [];
  private fileName: string | null = null;

  setSheetData(data: string[][], fileName?: string) {
    this.sheetData = data;
    if (fileName) this.fileName = fileName;
  }

  getSheetData(): string[][] {
    return this.sheetData;
  }

  getFileName(): string | null {
    return this.fileName;
  }

  clear() {
    this.sheetData = [];
    this.fileName = null;
  }

}
