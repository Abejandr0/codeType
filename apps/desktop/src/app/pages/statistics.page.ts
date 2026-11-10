import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { API_URL, SessionService } from '../core/session.service';

@Component({ standalone: true, template: `
  <header class="page-heading"><div><div class="eyebrow">TU RENDIMIENTO</div><h1>Estadísticas</h1><p>Identifica tus puntos fuertes y mejora la velocidad al programar.</p></div></header>
  @if (loading()) { <section class="card">Cargando tus resultados…</section> } @else if (error()) { <section class="card empty-state"><h3>No se pudieron cargar las estadísticas</h3><p>{{ error() }}</p></section> } @else if (stats(); as data) { <div class="stats-grid"><section class="card stat-card"><span class="muted">Velocidad promedio</span><strong>{{ data.summary.averageWpm | number:'1.0-0' }} <small>WPM</small></strong></section><section class="card stat-card"><span class="muted">Precisión promedio</span><strong>{{ data.summary.averageAccuracy | number:'1.0-1' }}<small>%</small></strong></section><section class="card stat-card"><span class="muted">Práctica total</span><strong>{{ Math.floor(data.summary.practiceMs / 60000) }} <small>min</small></strong></section><section class="card"><h3>Caracteres con errores</h3>@for (item of data.commonErrors.slice(0, 8); track item.character) { <div class="error-ranking"><div><b>{{ item.character === ' ' ? 'Espacio' : item.character }}</b><span>{{ item.count }} errores</span></div></div> } @if (!data.commonErrors.length) { <p class="muted">Aún no hay errores registrados.</p> }</section></div> }
` })
export class StatisticsPageComponent {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  readonly stats = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly Math = Math;
  constructor() { effect(() => { if (!this.session.token()) return; this.http.get<any>(`${API_URL}/stats?days=7`).subscribe({ next: (data) => { this.stats.set(data); this.loading.set(false); }, error: () => { this.error.set('Inicia sesión y completa una práctica para ver tu historial.'); this.loading.set(false); } }); }); }
}
