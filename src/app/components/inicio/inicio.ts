import { Component, OnInit } from '@angular/core';
import * as XLSX from 'xlsx';
import { FileUploadModule } from 'primeng/fileupload';
import { ListboxModule } from 'primeng/listbox';
import { FormsModule } from '@angular/forms';
import { XlsxDataService } from '../../services/xlsx-data-service';
import { ProgressSpinner } from 'primeng/progressspinner';
import { ChartModule } from 'primeng/chart';
import {DecimalPipe} from '@angular/common';

@Component({
  selector: 'app-inicio',
  standalone: true,
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  imports: [FileUploadModule, ListboxModule, FormsModule, ProgressSpinner, ChartModule, DecimalPipe]
})
export class Inicio implements OnInit {
  sheetData: string[][] = [];
  headerRowIndex = 6;
  headerColumns: { name: string, value: number }[] = [];
  loading = false;

  // Para gráfica y análisis
  colX = 0;
  colY = 1;
  columnOptions: { label: string, value: number }[] = [];
  chartData: any;
  chartOptions: any;
  correlation: number | null = null;
  regression: { slope: number, intercept: number } | null = null;

  constructor(private xlsxService: XlsxDataService) {}

  ngOnInit() {
    this.sheetData = this.xlsxService.getSheetData();
    this.setHeaderColumns();
    this.initColumnOptions();
    this.prepareChart();
  }

  onFileSelect(event: any) {
    const file = event.files?.[0];
    if (!file) return;
    this.loading = true;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as unknown[];
      const parsed = json.map(row => Array.isArray(row) ? row.map(cell => String(cell ?? "")) : []);
      this.sheetData = parsed;
      this.setHeaderColumns();
      this.xlsxService.setSheetData(parsed, file.name);
      this.initColumnOptions();
      this.prepareChart();
      this.loading = false;
    };
    reader.onerror = () => {
      this.loading = false;
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
    this.initColumnOptions();
    this.prepareChart();
  }

  initColumnOptions() {
    // Usa la fila de encabezado seleccionada por el usuario
    const headerRow = this.sheetData[this.headerRowIndex] || [];
    this.columnOptions = headerRow.map((name, idx) => ({
      label: name ? String(name) : `Columna ${idx + 1}`,
      value: idx
    }));
    // Ajusta selección si las columnas cambiaron
    if (this.colX >= this.columnOptions.length) this.colX = 0;
    if (this.colY >= this.columnOptions.length) this.colY = 1;
  }

  onColumnChange() {
    this.prepareChart();
  }

  prepareChart() {
    if (!this.sheetData.length || this.colX === this.colY) {
      this.chartData = null;
      this.correlation = null;
      this.regression = null;
      return;
    }
    // Extrae solo las filas numéricas (omite encabezado y vacías)
    const rows = this.sheetData.filter(
      (row, idx) =>
        idx > 0 &&
        !isNaN(Number(row[this.colX])) &&
        !isNaN(Number(row[this.colY]))
    );
    const x = rows.map(row => Number(row[this.colX]));
    const y = rows.map(row => Number(row[this.colY]));

    if (!x.length || !y.length) {
      this.chartData = null;
      this.correlation = null;
      this.regression = null;
      return;
    }

    this.correlation = this.getCorrelation(x, y);
    const { slope, intercept } = this.linearRegression(x, y);
    this.regression = { slope, intercept };
    const yReg = x.map(xi => slope * xi + intercept);

    this.chartData = {
      labels: x,
      datasets: [
        {
          label: 'Datos',
          data: y,
          borderColor: '#2fffa5',
          backgroundColor: '#2fffa588',
          type: 'scatter',
          showLine: false,
          pointRadius: 5
        },
        {
          label: 'Regresión Lineal',
          data: yReg,
          borderColor: '#ff3c7e',
          backgroundColor: '#ff3c7e55',
          type: 'line',
          fill: false,
          pointRadius: 0,
          tension: 0
        }
      ]
    };

    this.chartOptions = {
      scales: {
        x: {
          title: { display: true, text: this.columnOptions[this.colX]?.label ?? 'Columna X' }
        },
        y: {
          title: { display: true, text: this.columnOptions[this.colY]?.label ?? 'Columna Y' }
        }
      },
      plugins: {
        legend: { labels: { color: '#fff' } },
        title: {
          display: true,
          text: 'Correlación y Regresión Lineal'
        }
      }
    };
  }

  // Correlación de Pearson
  getCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    const num = x.map((xi, i) => (xi - meanX) * (y[i] - meanY)).reduce((a, b) => a + b, 0);
    const denX = Math.sqrt(x.map(xi => Math.pow(xi - meanX, 2)).reduce((a, b) => a + b, 0));
    const denY = Math.sqrt(y.map(yi => Math.pow(yi - meanY, 2)).reduce((a, b) => a + b, 0));
    return num / (denX * denY);
  }

  // Regresión lineal (y = slope * x + intercept)
  linearRegression(x: number[], y: number[]) {
    const n = x.length;
    if (n === 0) return { slope: 0, intercept: 0 };
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    const num = x.map((xi, i) => (xi - meanX) * (y[i] - meanY)).reduce((a, b) => a + b, 0);
    const den = x.map(xi => Math.pow(xi - meanX, 2)).reduce((a, b) => a + b, 0);
    const slope = num / den;
    const intercept = meanY - slope * meanX;
    return { slope, intercept };
  }
}
