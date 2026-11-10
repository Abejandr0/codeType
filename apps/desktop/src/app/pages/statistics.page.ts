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
  summary: { averageWpm: number; averageAccuracy: number; practiceMs: number; completed: number };
}

@Component({ standalone: true, imports: [CommonModule, RouterLink, ProgressChartComponent], template: `
  <header class="page-heading"><div><div class="eyebrow">{{ t('TU RENDIMIENTO') }}</div><h1>{{ t('Estadísticas') }}</h1><p>{{ t('Identifica tus puntos fuertes y mejora la velocidad al programar.') }}</p></div></header>
  <div class="filter-tabs" role="group" [attr.aria-label]="t('Período de estadísticas')">
    @for (filter of filters; track filter.value) { <button type="button" [class.selected]="days() === filter.value" [attr.aria-pressed]="days() === filter.value" (click)="days.set(filter.value)">{{ t(filter.label) }}</button> }
  </div>
  @if (!session.token()) { <section class="card empty-state"><h3>{{ t('Inicia sesión para ver tus estadísticas') }}</h3><p>{{ t('Tus resultados aparecen aquí después de practicar.') }}</p></section> }
  @else if (loading()) { <section class="card">{{ t('Cargando tus resultados…') }}</section> }
  @else if (error()) { <section class="card empty-state"><h3>{{ t('No se pudieron cargar las estadísticas') }}</h3><p>{{ t(error()) }}</p><button class="button secondary" (click)="reload()">{{ t('Reintentar') }}</button></section> }
  @else if (stats(); as data) {
    <div class="stats-summary-grid stats-summary">
      <section class="card stat-card"><span class="muted">{{ t('Velocidad promedio') }}</span><strong>{{ data.summary.averageWpm | number:'1.0-0' }} <small>WPM</small></strong><span class="stat-foot">{{ data.attempts.length }} {{ t('sesiones') }}</span></section>
      <section class="card stat-card"><span class="muted">{{ t('Precisión promedio') }}</span><strong>{{ data.summary.averageAccuracy | number:'1.0-1' }}<small>%</small></strong><span class="stat-foot">{{ t('En el período seleccionado') }}</span></section>
      <section class="card stat-card"><span class="muted">{{ t('Tiempo de práctica') }}</span><strong>{{ Math.floor(data.summary.practiceMs / 60000) }} <small>{{ t('min') }}</small></strong><span class="stat-foot">{{ data.summary.completed }} {{ t('ejercicios aprobados') }}</span></section>
    </div>
    <section class="card chart-card"><div class="card-title-row"><div><h3>{{ t('Progreso de escritura') }}</h3><p class="muted">{{ t('WPM y precisión de cada intento guardado') }}</p></div></div>
      @if (data.attempts.length) { <app-progress-chart [attempts]="data.attempts" /> } @else { <div class="chart-empty">{{ t('Completa una práctica para ver tu progreso.') }}</div> }
    </section>
    <div class="stats-grid stats-lower">
      <section class="card"><h3>{{ t('Mapa de errores del teclado') }}</h3><p class="muted">{{ t('La intensidad refleja tus errores guardados en el período.') }}</p><div class="heatmap">@for (row of keyboardRows; track $index) { <div class="heat-row">@for (character of row; track character) { <span [style.background-color]="heatColor(character)" [attr.title]="errorCount(character) + ' ' + t('errores')">{{ character }}</span> }</div> }</div></section>
      <section class="card"><h3>{{ t('Caracteres que cuestan más') }}</h3>@if (data.commonErrors.length) { <div class="error-ranking">@for (item of data.commonErrors.slice(0, 10); track item.character) { <div><b>{{ readableCharacter(item.character) }}</b><span>{{ item.count }} {{ t('errores') }}</span></div> }</div> } @else { <p class="muted">{{ t('Todavía no hay errores registrados.') }}</p> }</section>
    </div>
    <section class="card recommendation-card"><div class="eyebrow">{{ t('ENTRENAMIENTO PERSONALIZADO') }}</div><h3>{{ t('Recomendación de práctica') }}</h3>
      @if (recommendationLoading()) { <p class="muted">{{ t('Analizando tus pulsaciones guardadas…') }}</p> }
      @else if (recommendationError()) { <p class="muted">{{ t(recommendationError()) }}</p> }
      @else if (recommendation()?.recommendation; as item) { <p><strong>{{ t(item.title) }}</strong><br />{{ t(item.tip) }}<br /><span class="muted">{{ item.errorCount }} {{ t('errores con') }} {{ readableCharacter(item.character) }}</span></p>@if (item.lesson) { <a class="button primary" [routerLink]="['/leccion', item.lesson.id]">{{ t('Entrenar ahora') }} · {{ t(item.lesson.title) }}</a> } }
      @else { <p>{{ t(recommendation()?.message ?? 'Completa algunas prácticas para recibir un consejo personalizado.') }}</p> }
    </section>
    @if (battles().length) { <section class="card battle-history"><h3>{{ t('Historial de rating Elo') }}</h3><div class="battle-history-list">@for (battle of battles(); track battle.id) { <div><span><b>{{ t(battle.winnerId === session.user()?.id ? 'Victoria' : battle.winnerId ? 'Derrota' : 'Empate') }}</b><small>{{ t(battle.lesson.title) }} · {{ battle.createdAt | date:'mediumDate' }}</small></span>@for (entry of battle.participants; track entry.id) { @if (entry.userId === session.user()?.id) { <strong>{{ entry.ratingBefore ?? '—' }} → {{ entry.ratingAfter ?? '—' }}</strong> } }</div> }</div></section> }
  }
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
  readonly keyboardRows = ['1234567890', 'qwertyuiop', 'asdfghjklñ', 'zxcvbnm'];
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
  readableCharacter(character: string): string { return character === ' ' ? this.t('Espacio') : character === '\n' ? this.t('Enter') : character === '\t' ? this.t('Tab') : `“${character}”`; }
  heatColor(character: string): string { const count = this.errorCount(character); const counts = this.stats()?.commonErrors.map((item) => item.count) ?? []; const max = Math.max(1, ...counts); const opacity = count ? 0.16 + 0.7 * count / max : 0; return `rgba(255, 138, 138, ${opacity})`; }
}
