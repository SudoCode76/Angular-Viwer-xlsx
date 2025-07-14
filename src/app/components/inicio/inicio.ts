import { Component, OnInit } from '@angular/core';
import * as XLSX from 'xlsx';
import { FileUploadModule } from 'primeng/fileupload';
import { ListboxModule } from 'primeng/listbox';
import { FormsModule } from '@angular/forms';
import { XlsxDataService } from '../../services/xlsx-data-service';
import { ProgressSpinner } from 'primeng/progressspinner';
import { ChartModule } from 'primeng/chart';
import {DecimalPipe, NgStyle} from '@angular/common';

@Component({
  selector: 'app-inicio',
  standalone: true,
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  imports: [FileUploadModule, ListboxModule, FormsModule, ProgressSpinner, ChartModule, DecimalPipe, NgStyle]
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

  // Estadísticas descriptivas
  estadisticas: any[] = [];

  // Mapa de calor
  heatmapLabels: string[] = [];
  heatmapMatrix: number[][] = [];

  constructor(private xlsxService: XlsxDataService) {}

  ngOnInit() {
    this.sheetData = this.xlsxService.getSheetData();
    this.setHeaderColumns();
    this.initColumnOptions();
    this.prepareChart();
    this.calcularHeatmapCorrelacion();
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
      this.calcularHeatmapCorrelacion();
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
    this.calcularHeatmapCorrelacion();
  }

  initColumnOptions() {
    const headerRow = this.sheetData[this.headerRowIndex] || [];
    this.columnOptions = headerRow.map((name, idx) => ({
      label: name ? String(name) : `Columna ${idx + 1}`,
      value: idx
    }));
    if (this.colX >= this.columnOptions.length) this.colX = 0;
    if (this.colY >= this.columnOptions.length) this.colY = 1;
  }

  onColumnChange() {
    this.prepareChart();
    this.calcularHeatmapCorrelacion();
  }

  prepareChart() {
    if (!this.sheetData.length || this.colX === this.colY) {
      this.chartData = null;
      this.correlation = null;
      this.regression = null;
      this.estadisticas = [];
      return;
    }
    // Extrae solo las filas numéricas (omite encabezado y vacías)
    const rows = this.sheetData.filter(
      (row, idx) =>
        idx > this.headerRowIndex &&
        !isNaN(Number(row[this.colX])) &&
        !isNaN(Number(row[this.colY]))
    );
    const x = rows.map(row => Number(row[this.colX]));
    const y = rows.map(row => Number(row[this.colY]));

    if (!x.length || !y.length) {
      this.chartData = null;
      this.correlation = null;
      this.regression = null;
      this.estadisticas = [];
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

    this.calcularEstadisticas();
    this.calcularHeatmapCorrelacion();
  }

  calcularEstadisticas() {
    this.estadisticas = [];
    if (!this.sheetData.length) return;
    const header = this.sheetData[this.headerRowIndex] || [];
    const datosNumericos: { nombre: string, valores: number[] }[] = [];

    // Para cada columna, si es numérica, procesa estadísticas
    for (let col = 0; col < header.length; col++) {
      const valores = this.sheetData
        .map((row, idx) =>
          idx > this.headerRowIndex && !isNaN(Number(row[col])) ? Number(row[col]) : undefined
        )
        .filter((v) => typeof v === "number") as number[];
      if (valores.length > 0) {
        datosNumericos.push({ nombre: header[col] || `Columna ${col + 1}`, valores });
      }
    }

    this.estadisticas = datosNumericos.map((col) => ({
      columna: col.nombre,
      media: this.media(col.valores),
      mediana: this.mediana(col.valores),
      moda: this.moda(col.valores),
      rango: this.rango(col.valores),
      desviacion: this.desviacion(col.valores),
      varianza: this.varianza(col.valores),
      rangoIntercuartilico: this.rangoIntercuartilico(col.valores)
    }));
  }

  // ----- HEATMAP -----
  calcularHeatmapCorrelacion() {
    const header = this.sheetData[this.headerRowIndex] || [];
    const colsNumericas: { idx: number, nombre: string, datos: number[] }[] = [];
    for (let col = 0; col < header.length; col++) {
      const datos = this.sheetData
        .map((row, idx) =>
          idx > this.headerRowIndex && !isNaN(Number(row[col])) ? Number(row[col]) : undefined
        )
        .filter((v) => typeof v === "number") as number[];
      if (datos.length > 0) {
        colsNumericas.push({ idx: col, nombre: header[col] || `Col ${col+1}`, datos });
      }
    }
    this.heatmapLabels = colsNumericas.map(c => c.nombre);

    // Crea matriz de correlaciones
    this.heatmapMatrix = colsNumericas.map((colA) =>
      colsNumericas.map((colB) => {
        const pares: [number, number][] = [];
        for (let i = 0; i < this.sheetData.length; i++) {
          if (
            i > this.headerRowIndex &&
            !isNaN(Number(this.sheetData[i][colA.idx])) &&
            !isNaN(Number(this.sheetData[i][colB.idx]))
          ) {
            pares.push([Number(this.sheetData[i][colA.idx]), Number(this.sheetData[i][colB.idx])]);
          }
        }
        const x = pares.map(p => p[0]);
        const y = pares.map(p => p[1]);
        return this.getCorrelation(x, y);
      })
    );
  }

  heatColor(val: number): string {
    // Escala pastel: azul pastel para 1, coral pastel para -1, casi blanco para 0
    if (isNaN(val)) return '#f2f7fa';
    if (val >= 0) {
      // De blanco a azul pastel
      const blue = Math.round(230 - (val * 100));
      const green = Math.round(245 - (val * 60));
      return `rgb(${225 - val*30},${green},${blue})`;
    } else {
      // De blanco a coral pastel
      const red = 255;
      const green = Math.round(230 + val * 50);
      const blue = Math.round(220 + val * 20);
      return `rgb(${red},${green},${blue})`;
    }
  }

  // ----- ESTADÍSTICAS -----
  media(arr: number[]) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  mediana(arr: number[]) {
    const a = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(a.length / 2);
    return a.length % 2 !== 0 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }
  moda(arr: number[]) {
    const freq: Record<number, number> = {};
    arr.forEach(val => freq[val] = (freq[val] || 0) + 1);
    const max = Math.max(...Object.values(freq));
    const modas = Object.entries(freq).filter(([_, v]) => v === max).map(([k]) => Number(k));
    return modas.length === arr.length ? null : modas.join(', ');
  }
  rango(arr: number[]) {
    return Math.max(...arr) - Math.min(...arr);
  }
  desviacion(arr: number[]) {
    const m = this.media(arr);
    return Math.sqrt(arr.reduce((acc, val) => acc + (val - m) ** 2, 0) / arr.length);
  }
  varianza(arr: number[]) {
    const m = this.media(arr);
    return arr.reduce((acc, val) => acc + (val - m) ** 2, 0) / arr.length;
  }
  rangoIntercuartilico(arr: number[]) {
    const a = [...arr].sort((a, b) => a - b);
    const q1 = this.percentil(a, 25);
    const q3 = this.percentil(a, 75);
    return q3 - q1;
  }
  percentil(arr: number[], p: number) {
    const pos = (arr.length - 1) * (p / 100);
    const base = Math.floor(pos);
    const rest = pos - base;
    if (arr[base + 1] !== undefined) {
      return arr[base] + rest * (arr[base + 1] - arr[base]);
    } else {
      return arr[base];
    }
  }

  // Correlación de Pearson
  getCorrelation(x: number[], y: number[]): number {
    if (!x.length || !y.length) return NaN;
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    const num = x.map((xi, i) => (xi - meanX) * (y[i] - meanY)).reduce((a, b) => a + b, 0);
    const denX = Math.sqrt(x.map(xi => Math.pow(xi - meanX, 2)).reduce((a, b) => a + b, 0));
    const denY = Math.sqrt(y.map(yi => Math.pow(yi - meanY, 2)).reduce((a, b) => a + b, 0));
    return (denX && denY) ? num / (denX * denY) : NaN;
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

  protected readonly Math = Math;
}
