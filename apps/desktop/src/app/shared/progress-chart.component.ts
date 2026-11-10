import { Component, DestroyRef, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { Chart, CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip, Legend } from 'chart.js';

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip, Legend);

interface Attempt { createdAt: string; wpm: number; accuracy: number }

@Component({ selector: 'app-progress-chart', standalone: true, template: `<div class="chart-wrap"><canvas #chart role="img" aria-label="Gráfica de progreso de velocidad y precisión"></canvas></div>` })
export class ProgressChartComponent {
  readonly attempts = input<Attempt[]>([]);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('chart');
  private readonly destroyRef = inject(DestroyRef);
  private chart?: Chart;

  constructor() {
    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      const attempts = this.attempts();
      if (!canvas) return;
      this.chart?.destroy();
      this.chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: attempts.map((attempt) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(new Date(attempt.createdAt))),
          datasets: [
            { label: 'WPM', data: attempts.map((attempt) => attempt.wpm), borderColor: '#7b8cff', backgroundColor: '#7b8cff22', pointBackgroundColor: '#7b8cff', tension: 0.32, yAxisID: 'wpm' },
            { label: 'Precisión %', data: attempts.map((attempt) => attempt.accuracy), borderColor: '#5fd49a', backgroundColor: '#5fd49a22', pointBackgroundColor: '#5fd49a', tension: 0.32, yAxisID: 'accuracy' },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#a9aec2' } }, tooltip: { mode: 'index', intersect: false } },
          scales: {
            x: { ticks: { color: '#a9aec2' }, grid: { color: '#2b2e3d' } },
            wpm: { type: 'linear', position: 'left', ticks: { color: '#a9aec2' }, grid: { color: '#2b2e3d' }, title: { display: true, text: 'WPM', color: '#a9aec2' } },
            accuracy: { type: 'linear', position: 'right', min: 0, max: 100, ticks: { color: '#a9aec2' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Precisión %', color: '#a9aec2' } },
          },
        },
      });
    });
    this.destroyRef.onDestroy(() => this.chart?.destroy());
  }
}
