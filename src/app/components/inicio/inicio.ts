import { Component, OnInit } from '@angular/core';
import * as XLSX from 'xlsx';
import { FileUploadModule } from 'primeng/fileupload';
import { ListboxModule } from 'primeng/listbox';
import { FormsModule } from '@angular/forms';
import { XlsxDataService } from '../../services/xlsx-data-service';
import { ProgressSpinner } from 'primeng/progressspinner';
import { ChartModule } from 'primeng/chart';
import { DecimalPipe, NgStyle } from '@angular/common';

@Component({
  selector: 'app-inicio',
  standalone: true,
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  imports: [FileUploadModule, ListboxModule, FormsModule, ProgressSpinner, ChartModule, DecimalPipe, NgStyle]
})
export class Inicio implements OnInit {
  sheetData: string[][] = [];
  headerRowIndex = 0; // Asegúrate de que es 0 si el encabezado está en la primera fila de tu XLSX
  headerColumns: { name: string, value: number }[] = [];
  loading = false;

  colX = 0;
  colY = 1;
  columnOptions: { label: string, value: number }[] = [];
  chartData: any = null;
  chartOptions: any = null;
  correlation: number | null = null;
  regression: { slope: number, intercept: number } | null = null;

  estadisticas: any[] = [];
  heatmapLabels: string[] = [];
  heatmapMatrix: number[][] = [];

  // Regresión múltiple
  yMultivar: number | null = null;
  xMultivarSeleccionadas: number[] = [];
  multiRegressionChartData: any = null;
  multiRegressionChartOptions: any = null;
  multiRegressionCoef: { intercept: number, coefs: number[] } | null = null;

  constructor(private xlsxService: XlsxDataService) {}

  ngOnInit() {
    this.sheetData = this.xlsxService.getSheetData() || [];
    this.setHeaderColumns();
    this.initColumnOptions();
    this.prepareChart();
    this.calcularHeatmapCorrelacion();
    this.yMultivar = this.columnOptions.length > 0 ? this.columnOptions[0].value : null;
    this.xMultivarSeleccionadas = this.columnOptions.length > 2 ? [this.columnOptions[1].value, this.columnOptions[2].value] : [];
    this.prepararGraficoRegresionMultiple();
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
      // Procesar filas, asegurando que sean arrays de strings
      const parsed = json.map(row => Array.isArray(row) ? row.map(cell => String(cell ?? "")) : []);
      this.sheetData = parsed || [];
      this.setHeaderColumns();
      this.xlsxService.setSheetData(parsed, file.name);
      this.initColumnOptions();
      this.prepareChart();
      this.calcularHeatmapCorrelacion();
      this.yMultivar = this.columnOptions.length > 0 ? this.columnOptions[0].value : null;
      this.xMultivarSeleccionadas = this.columnOptions.length > 2 ? [this.columnOptions[1].value, this.columnOptions[2].value] : [];
      this.prepararGraficoRegresionMultiple();
      this.loading = false;
    };
    reader.onerror = () => {
      this.loading = false;
    };
    reader.readAsArrayBuffer(file);
  }

  setHeaderColumns() {
    if (this.sheetData && this.sheetData.length > this.headerRowIndex) {
      this.headerColumns = (this.sheetData[this.headerRowIndex] ?? []).map((name, idx) => ({
        name: name || `Col ${idx + 1}`,
        value: idx
      }));
    } else {
      this.headerColumns = [];
    }
  }

  onHeaderRowChange() {
    this.setHeaderColumns();
    this.initColumnOptions();
    this.prepareChart();
    this.calcularHeatmapCorrelacion();
    this.yMultivar = this.columnOptions.length > 0 ? this.columnOptions[0].value : null;
    this.xMultivarSeleccionadas = this.columnOptions.length > 2 ? [this.columnOptions[1].value, this.columnOptions[2].value] : [];
    this.prepararGraficoRegresionMultiple();
  }

  initColumnOptions() {
    const headerRow = (this.sheetData && this.sheetData[this.headerRowIndex]) || [];
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
    if (!this.sheetData || !this.sheetData.length || this.colX === this.colY) {
      this.chartData = null;
      this.correlation = null;
      this.regression = null;
      this.estadisticas = [];
      return;
    }
    // Usar replace(',', '.') para convertir decimales con coma a punto
    const rows = this.sheetData.filter(
      (row, idx) =>
        idx > this.headerRowIndex &&
        row &&
        !isNaN(Number(String(row[this.colX]).replace(',', '.'))) &&
        !isNaN(Number(String(row[this.colY]).replace(',', '.')))
    );
    const x = rows.map(row => Number(String(row[this.colX]).replace(',', '.')));
    const y = rows.map(row => Number(String(row[this.colY]).replace(',', '.')));

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
      datasets: [
        {
          label: 'Datos',
          data: x.map((xi, i) => ({ x: xi, y: y[i] })),
          borderColor: '#47c0ff',
          backgroundColor: '#47c0ff',
          pointBackgroundColor: '#47c0ff',
          showLine: false,
          type: 'scatter',
          pointRadius: 6,
          pointHoverRadius: 7,
          order: 2
        },
        {
          label: 'Regresión Lineal',
          data: x.map((xi, i) => ({ x: xi, y: yReg[i] })),
          borderColor: '#ff3c3c',
          backgroundColor: 'rgba(255,60,60,0.3)',
          fill: false,
          type: 'line',
          pointRadius: 0,
          borderWidth: 2,
          tension: 0,
          order: 1
        }
      ]
    };

    this.chartOptions = {
      plugins: {
        legend: {
          labels: { color: '#fff' }
        },
        title: {
          display: true,
          text: 'Correlación y Regresión Lineal',
          color: '#fff',
          font: { size: 18 }
        }
      },
      scales: {
        x: {
          title: { display: true, text: this.columnOptions[this.colX]?.label ?? 'Columna X', color: '#fff', font: { size: 15 } },
          ticks: { color: '#e3e3e3' },
          grid: { color: '#333' }
        },
        y: {
          title: { display: true, text: this.columnOptions[this.colY]?.label ?? 'Columna Y', color: '#fff', font: { size: 15 } },
          ticks: { color: '#e3e3e3' },
          grid: { color: '#333' }
        }
      },
      layout: {
        padding: 24
      },
      backgroundColor: '#18191a'
    };

    this.calcularEstadisticas();
    this.calcularHeatmapCorrelacion();
  }

  calcularEstadisticas() {
    this.estadisticas = [];
    if (!this.sheetData || !this.sheetData.length) return;
    const header = this.sheetData[this.headerRowIndex] || [];
    const datosNumericos: { nombre: string, valores: number[] }[] = [];
    for (let col = 0; col < header.length; col++) {
      const valores = this.sheetData
        .map((row, idx) =>
          idx > this.headerRowIndex &&
          row &&
          !isNaN(Number(String(row[col]).replace(',', '.')))
            ? Number(String(row[col]).replace(',', '.'))
            : undefined
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

  calcularHeatmapCorrelacion() {
    const header = (this.sheetData && this.sheetData[this.headerRowIndex]) || [];
    const colsNumericas: { idx: number, nombre: string, datos: number[] }[] = [];
    for (let col = 0; col < header.length; col++) {
      const datos = this.sheetData
        .map((row, idx) =>
          idx > this.headerRowIndex &&
          row &&
          !isNaN(Number(String(row[col]).replace(',', '.')))
            ? Number(String(row[col]).replace(',', '.'))
            : undefined
        )
        .filter((v) => typeof v === "number") as number[];
      if (datos.length > 0) {
        colsNumericas.push({ idx: col, nombre: header[col] || `Col ${col+1}`, datos });
      }
    }
    this.heatmapLabels = colsNumericas.map(c => c.nombre);
    this.heatmapMatrix = colsNumericas.map((colA) =>
      colsNumericas.map((colB) => {
        const pares: [number, number][] = [];
        for (let i = 0; i < (this.sheetData?.length || 0); i++) {
          if (
            i > this.headerRowIndex &&
            this.sheetData &&
            this.sheetData[i] &&
            !isNaN(Number(String(this.sheetData[i][colA.idx]).replace(',', '.'))) &&
            !isNaN(Number(String(this.sheetData[i][colB.idx]).replace(',', '.')))
          ) {
            pares.push([
              Number(String(this.sheetData[i][colA.idx]).replace(',', '.')),
              Number(String(this.sheetData[i][colB.idx]).replace(',', '.'))
            ]);
          }
        }
        const x = pares.map(p => p[0]);
        const y = pares.map(p => p[1]);
        return this.getCorrelation(x, y);
      })
    );
  }

  heatColor(val: number): string {
    if (isNaN(val)) return '#f2f7fa';
    if (val >= 0) {
      const blue = Math.round(230 - (val * 100));
      const green = Math.round(245 - (val * 60));
      return `rgb(${225 - val*30},${green},${blue})`;
    } else {
      const red = 255;
      const green = Math.round(230 + val * 50);
      const blue = Math.round(220 + val * 20);
      return `rgb(${red},${green},${blue})`;
    }
  }

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

  // --- Regresión múltiple ---
  onYMultivarChange() {
    this.prepararGraficoRegresionMultiple();
  }
  onXMultivarSeleccionadasChange() {
    this.prepararGraficoRegresionMultiple();
  }

  prepararGraficoRegresionMultiple() {
    if (
      !this.sheetData ||
      !this.sheetData.length ||
      this.yMultivar === null ||
      this.xMultivarSeleccionadas.length === 0
    ) {
      this.multiRegressionChartData = null;
      this.multiRegressionCoef = null;
      return;
    }

    const rows = this.sheetData.filter((row, idx) => idx > this.headerRowIndex);
    // Filtra filas con todos los X y Y numéricos
    const validRows = rows.filter(row =>
      this.yMultivar !== null &&
      !isNaN(Number(row[this.yMultivar])) &&
      this.xMultivarSeleccionadas.every(idx => !isNaN(Number(row[idx])))
    );
    if (validRows.length === 0) {
      this.multiRegressionChartData = null;
      this.multiRegressionCoef = null;
      return;
    }

    // Matriz X, columna extra de 1 para el intercepto
    const X = validRows.map(row => [1, ...this.xMultivarSeleccionadas.map(idx => Number(row[idx]))]);
    // Vector Y
    const Y = validRows.map(row => Number(row[this.yMultivar!]));

    // Calcular coeficientes por mínimos cuadrados: beta = (X^T X)^(-1) X^T Y
    const XT = this.transpose(X);
    const XTX = this.multiplyMatrices(XT, X);
    const XTX_inv = this.invertMatrix(XTX);
    if (!XTX_inv) {
      this.multiRegressionChartData = null;
      this.multiRegressionCoef = null;
      return;
    }
    const XTY = this.multiplyMatrixVector(XT, Y);
    const beta = this.multiplyMatrixVector(XTX_inv, XTY); // [intercept, coef_x1, coef_x2, ...]
    const intercept = beta[0];
    const coefs = beta.slice(1);

    // Y predicho
    const Y_predicho = X.map(row => beta.reduce((acc, b, i) => acc + b * row[i], 0));

    this.multiRegressionCoef = { intercept, coefs };

    // Chart.js
    this.multiRegressionChartData = {
      labels: validRows.map((_, i) => `Fila ${i + 1}`),
      datasets: [
        {
          label: "Y real (" + (this.columnOptions[this.yMultivar]?.label ?? "Y") + ")",
          data: Y,
          borderColor: "#2fffa5",
          backgroundColor: "#2fffa588",
          fill: false,
          pointRadius: 3,
          tension: 0.1
        },
        {
          label: "Y predicho (Regresión múltiple)",
          data: Y_predicho,
          borderColor: "#ff3c7e",
          backgroundColor: "#ff3c7e55",
          fill: false,
          pointRadius: 3,
          tension: 0.1
        }
      ]
    };

    this.multiRegressionChartOptions = {
      plugins: {
        legend: { labels: { color: "#3a3a3a" } },
        title: { display: true, text: "Regresión lineal múltiple: Y vs X's seleccionadas" }
      },
      scales: {
        x: { title: { display: true, text: "Fila" }, ticks: { color: "#3a3a3a" } },
        y: { title: { display: true, text: "Valor" }, ticks: { color: "#3a3a3a" } }
      }
    };
  }

  transpose(A: number[][]): number[][] {
    return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
  }
  multiplyMatrices(A: number[][], B: number[][]): number[][] {
    const result: number[][] = Array(A.length)
      .fill(0)
      .map(() => Array(B[0].length).fill(0));
    for (let i = 0; i < A.length; i++)
      for (let j = 0; j < B[0].length; j++)
        for (let k = 0; k < B.length; k++)
          result[i][j] += A[i][k] * B[k][j];
    return result;
  }
  multiplyMatrixVector(A: number[][], v: number[]): number[] {
    return A.map(row => row.reduce((sum, val, i) => sum + val * v[i], 0));
  }
  invertMatrix(matrix: number[][]): number[][] | null {
    const n = matrix.length;
    const M = matrix.map(row => [...row]);
    const I = Array(n)
      .fill(0)
      .map((_, i) => Array(n).fill(0));
    for (let i = 0; i < n; i++) I[i][i] = 1;
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++)
        if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
      [M[i], M[maxRow]] = [M[maxRow], M[i]];
      [I[i], I[maxRow]] = [I[maxRow], I[i]];
      if (Math.abs(M[i][i]) < 1e-12) return null;
      const f = M[i][i];
      for (let j = 0; j < n; j++) M[i][j] /= f;
      for (let j = 0; j < n; j++) I[i][j] /= f;
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const f2 = M[k][i];
          for (let j = 0; j < n; j++) M[k][j] -= f2 * M[i][j];
          for (let j = 0; j < n; j++) I[k][j] -= f2 * I[i][j];
        }
      }
    }
    return I;
  }

  protected readonly Math = Math;
}
