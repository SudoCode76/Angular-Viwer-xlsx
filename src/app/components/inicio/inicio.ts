import { Component } from '@angular/core';
import * as XLSX from 'xlsx';
import { FileUploadModule } from 'primeng/fileupload';
import { ListboxModule } from 'primeng/listbox';
import {FormsModule} from '@angular/forms';


@Component({
  selector: 'app-inicio',
  standalone: true,
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  imports: [FileUploadModule, ListboxModule, FormsModule]
})
export class Inicio {
  sheetData: string[][] = []; // Usar siempre array, nunca null
  headerRowIndex = 6;
  headerColumns: {name: string, value: number}[] = [];

  onFileSelect(event: any) {
    const file = event.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as unknown[];
      // Aseguramos tipado como string[][]
      this.sheetData = json.map(row => Array.isArray(row) ? row.map(cell => String(cell)) : []);
      this.setHeaderColumns();
    };
    reader.readAsArrayBuffer(file);
  }

  setHeaderColumns() {
    if (this.sheetData.length > this.headerRowIndex) {
      this.headerColumns = (this.sheetData[this.headerRowIndex] ?? []).map((name, idx) => ({
        name: name || `Col ${idx + 1}`,
        value: idx
      }));
    }
  }

  onHeaderRowChange() {
    this.setHeaderColumns();
  }
}
