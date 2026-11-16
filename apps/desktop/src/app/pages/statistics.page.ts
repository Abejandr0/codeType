import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { API_URL, SessionService } from '../core/session.service';
import { ProgressChartComponent } from '../shared/progress-chart.component';
import { translate } from '../core/translation';

interface StatsResponse {
  attempts: Array<{ id: string; createdAt: string; wpm: number; accuracy: number; durationMs: number; passed: boolean }>;
  commonErrors: Array<{ character: string; count: number }>;
  hardElements: Array<{ element: string; count: number }>;
  summary: { averageWpm: number; averageAccuracy: number; practiceMs: number; completed: number };
}

@Component({ standalone: true, imports: [CommonModule, RouterLink, ProgressChartComponent], template: `
  <div class="statistics-page">
  <header class="page-heading stats-heading"><div><div class="eyebrow">{{ t('TU RENDIMIENTO') }}</div><h1>{{ t('Estadísticas') }}</h1><p>{{ t('Identifica tus puntos fuertes y mejora la velocidad al programar.') }}</p></div>
    <div class="filter-tabs" role="group" [attr.aria-label]="t('Período de estadísticas')">
    @for (filter of filters; track filter.value) { <button type="button" [class.selected]="days() === filter.value" [attr.aria-pressed]="days() === filter.value" (click)="days.set(filter.value)">{{ t(filter.label) }}</button> }
    </div>
  </header>
  @if (!session.token()) { <section class="card empty-state"><h3>{{ t('Inicia sesión para ver tus estadísticas') }}</h3><p>{{ t('Tus resultados aparecen aquí después de practicar.') }}</p></section> }
  @else if (loading()) { <section class="card">{{ t('Cargando tus resultados…') }}</section> }
  @else if (error()) { <section class="card empty-state"><h3>{{ t('No se pudieron cargar las estadísticas') }}</h3><p>{{ t(error()) }}</p><button class="button secondary" (click)="reload()">{{ t('Reintentar') }}</button></section> }
  @else if (stats(); as data) {
    <div class="stats-summary-grid stats-summary">
      <section class="card stat-card"><div class="stat-card-heading"><span class="stat-icon purple" aria-hidden="true">W</span><span class="muted">{{ t('Velocidad promedio') }}</span></div><strong>@if (data.attempts.length) { {{ data.summary.averageWpm | number:'1.0-0' }} } @else { — } <small>WPM</small></strong><span class="stat-foot">{{ data.attempts.length ? data.attempts.length + ' ' + t('sesiones') : t('Practica una sesión para ver este dato') }}</span></section>
      <section class="card stat-card"><div class="stat-card-heading"><span class="stat-icon green" aria-hidden="true">%</span><span class="muted">{{ t('Precisión promedio') }}</span></div><strong>@if (data.attempts.length) { {{ data.summary.averageAccuracy | number:'1.0-1' }} } @else { — }<small>%</small></strong><span class="stat-foot">{{ t('En el período seleccionado') }}</span></section>
      <section class="card stat-card"><div class="stat-card-heading"><span class="stat-icon amber" aria-hidden="true">min</span><span class="muted">{{ t('Tiempo de práctica') }}</span></div><strong>{{ Math.floor(data.summary.practiceMs / 60000) }} <small>{{ t('min') }}</small></strong><span class="stat-foot">{{ data.summary.completed }} {{ t('ejercicios aprobados') }}</span></section>
    </div>
    <section class="card chart-card stats-chart"><div class="card-title-row"><div><h3>{{ t('Progreso de escritura') }}</h3><p class="muted">{{ t('WPM y precisión de cada intento guardado') }}</p></div></div>
      @if (data.attempts.length) { <app-progress-chart [attempts]="data.attempts" /> } @else { <div class="chart-empty"><strong>{{ t('Aún no hay sesiones en este período') }}</strong><span>{{ t('Completa una práctica para crear tu gráfica con tus resultados reales.') }}</span><a class="button secondary" routerLink="/ejercicios">{{ t('Ir a ejercicios') }}</a></div> }
    </section>
    <div class="stats-grid stats-lower">
      <section class="card stats-heatmap"><div class="stats-section-heading"><div><h3>{{ t('Mapa de errores del teclado') }}</h3><p class="muted">{{ t('La intensidad refleja tus errores guardados en el período.') }}</p></div><span class="stats-data-tag">{{ data.commonErrors.length }} {{ t('teclas con errores') }}</span></div><div class="heatmap" role="group" [attr.aria-label]="t('Mapa de calor de errores por tecla')">@for (row of keyboardRows; track $index) { <div class="heat-row">@for (key of row; track key.label) { <span [class.heat-wide]="key.wide" [style.background-color]="heatColor(key.character)" [attr.title]="readableCharacter(key.character) + ': ' + errorCount(key.character) + ' ' + t('errores')">{{ key.label }}</span> }</div> }</div><div class="heatmap-legend"><span>{{ t('Sin errores') }}</span><i></i><span>{{ t('Más errores') }}</span></div></section>
      <section class="card stats-error-ranking"><div class="stats-section-heading"><div><h3>{{ t('Palabras y elementos que cuestan más') }}</h3><p class="muted">{{ t('Se basa en caracteres guardados de tus prácticas.') }}</p></div></div>@if (data.hardElements.length) { <div class="error-ranking">@for (item of data.hardElements.slice(0, 8); track item.element) { <div><b>{{ t(item.element) }}</b><span class="progress-track" aria-hidden="true"><span [style.width.%]="rankingWidth(item.count, data.hardElements)"></span></span><span>{{ item.count }}</span></div> }</div> } @else { <div class="stats-empty-inline">{{ t('Todavía no hay errores registrados.') }}</div> }</section>
    </div>
    <section class="card recommendation-card"><div class="eyebrow">{{ t('ENTRENAMIENTO PERSONALIZADO') }}</div><h3>{{ t('Recomendación de práctica') }}</h3>
      @if (recommendationLoading()) { <p class="muted">{{ t('Analizando tus pulsaciones guardadas…') }}</p> }
      @else if (recommendationError()) { <p class="muted">{{ t(recommendationError()) }}</p> }
      @else if (recommendation()?.recommendation; as item) { <p><strong>{{ t(item.title) }}</strong><br />{{ t(item.tip) }}<br /><span class="muted">{{ item.errorCount }} {{ t('errores con') }} {{ readableCharacter(item.character) }}</span></p>@if (item.lesson) { <a class="button primary" [routerLink]="['/leccion', item.lesson.id]">{{ t('Entrenar ahora') }} · {{ t(item.lesson.title) }}</a> } }
      @else { <p>{{ t(recommendation()?.message ?? 'Completa algunas prácticas para recibir un consejo personalizado.') }}</p> }
    </section>
    @if (battles().length) { <section class="card battle-history"><h3>{{ t('Historial de rating Elo') }}</h3><div class="battle-history-list">@for (battle of battles(); track battle.id) { <div><span><b>{{ t(battle.winnerId === session.user()?.id ? 'Victoria' : battle.winnerId ? 'Derrota' : 'Empate') }}</b><small>{{ t(battle.lesson.title) }} · {{ battle.createdAt | date:'mediumDate' }}</small></span>@for (entry of battle.participants; track entry.id) { @if (entry.userId === session.user()?.id) { <strong>{{ entry.ratingBefore ?? '—' }} → {{ entry.ratingAfter ?? '—' }}</strong> } }</div> }</div></section> }
  }
  </div>
` })
export class StatisticsPageComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly session = inject(SessionService);
  t(text: string): string { return translate(text, this.session.language()); }
  readonly days = signal('7');
  private readonly refreshKey = signal(0);
  readonly stats = signal<StatsResponse | null>(null);
  readonly recommendation = signal<any>(null);
  readonly battles = signal<any[]>([]);
  readonly loading = signal(false);
  readonly recommendationLoading = signal(false);
  readonly error = signal('');
  readonly recommendationError = signal('');
  readonly Math = Math;
  readonly filters = [{ value: '7', label: '7 días' }, { value: '30', label: '30 días' }, { value: 'all', label: 'Todo' }];
  readonly keyboardRows = [
    '1234567890-='.split('').map((character) => ({ label: character, character, wide: false })),
    'qwertyuiop[]'.split('').map((character) => ({ label: character, character, wide: false })),
    'asdfghjklñ'.split('').map((character) => ({ label: character, character, wide: false })),
    'zxcvbnm,./'.split('').map((character) => ({ label: character, character, wide: false })),
    [{ label: 'Tab', character: '\t', wide: true }, { label: 'Espacio', character: ' ', wide: true }, { label: 'Enter', character: '\n', wide: true }],
  ];
  private statsRequest?: Subscription;
  private socialRequest?: Subscription;

  constructor() {
    effect(() => {
      const token = this.session.token();
      const days = this.days();
      this.refreshKey();
      this.statsRequest?.unsubscribe();
      if (!token) { this.stats.set(null); this.loading.set(false); return; }
      this.loading.set(true); this.error.set('');
      const range = days === 'all' ? 0 : Number(days);
      this.statsRequest = this.http.get<StatsResponse>(`${API_URL}/stats?days=${range}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => { this.stats.set(value); this.loading.set(false); }, error: () => { this.error.set('No se pudieron consultar tus resultados.'); this.loading.set(false); } });
    });
    effect(() => {
      const token = this.session.token();
      this.socialRequest?.unsubscribe();
      if (!token) { this.recommendation.set(null); this.battles.set([]); return; }
      this.recommendationLoading.set(true); this.recommendationError.set('');
      this.http.get<any>(`${API_URL}/recommendations`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => { this.recommendation.set(value); this.recommendationLoading.set(false); }, error: () => { this.recommendationError.set('No se pudo analizar tu historial.'); this.recommendationLoading.set(false); } });
      this.http.get<any[]>(`${API_URL}/battles`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (rows) => this.battles.set(rows), error: () => this.battles.set([]) });
    });
  }

  reload(): void { this.error.set(''); this.refreshKey.update((value) => value + 1); }
  errorCount(character: string): number { return this.stats()?.commonErrors.find((item) => item.character === character)?.count ?? 0; }
  rankingWidth(count: number, items: Array<{ count: number }>): number { return Math.max(6, Math.round(count / Math.max(1, ...items.map((item) => item.count)) * 100)); }
  readableCharacter(character: string): string { return character === ' ' ? this.t('Espacio') : character === '\n' ? this.t('Enter') : character === '\t' ? this.t('Tab') : `“${character}”`; }
  heatColor(character: string): string { const count = this.errorCount(character); const counts = this.stats()?.commonErrors.map((item) => item.count) ?? []; const max = Math.max(1, ...counts); const opacity = count ? 0.16 + 0.7 * count / max : 0; return count ? `rgba(255, 138, 138, ${opacity})` : '#252733'; }
}
