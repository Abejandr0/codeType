import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_URL, SessionService } from '../core/session.service';
import { translate } from '../core/translation';

interface Lesson { id: string; title: string; language: string; path: string; level: number; code: string; status: 'locked' | 'in_progress' | 'completed' }
interface Dashboard { streakDays: number; xp: number; rating: number; dailyGoalMinutes: number; todayPracticeMs: number; dailyChallenge: Lesson | null; lastActivity: { wpm: number; accuracy: number; lesson: Lesson } | null; recentActivities: Array<{ wpm: number; createdAt: string; lesson: Lesson }> }

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="page-heading"><div><div class="eyebrow">{{ t('TU ESPACIO DE APRENDIZAJE') }}</div><h1>{{ t('Panel de Inicio') }}</h1><p>{{ t('Continúa tu camino hacia la maestría del código') }}{{ name() ? ', ' + name() : '.' }}</p></div><div class="header-streak">🔥 <b>{{ t('Racha') }}</b><strong>{{ data()?.streakDays ?? 0 }} {{ t('días') }}</strong></div></header>
    <div class="stats-grid dashboard-stats"><section class="card stat-card"><span class="muted">{{ t('Última velocidad') }}</span><strong>{{ data()?.lastActivity?.wpm ?? 0 }} <small>WPM</small></strong><span class="stat-foot">{{ t('Última práctica guardada') }}</span></section><section class="card stat-card"><span class="muted">{{ t('Precisión reciente') }}</span><strong>{{ data()?.lastActivity?.accuracy ?? 0 }}<small>%</small></strong><span class="stat-foot">{{ t('En el último intento') }}</span></section><section class="card stat-card"><span class="muted">{{ t('Experiencia acumulada') }}</span><strong>{{ data()?.xp ?? session.user()?.xp ?? 0 }} <small>XP</small></strong><span class="stat-foot">{{ t('Nivel') }} {{ Math.floor((data()?.xp ?? session.user()?.xp ?? 0) / 100) + 1 }}</span></section></div>
    <div class="dashboard-grid dashboard-primary">
      <section class="card next-card reference-next"><div class="eyebrow">{{ t('SIGUIENTE LECCIÓN') }}</div>
        @if (loading()) { <h3>{{ t('Cargando lecciones…') }}</h3> }
        @else if (error()) { <h3>{{ t('No se pudieron cargar los datos') }}</h3><p class="muted">{{ t(error()) }}</p> }
        @else if (next()) { <h2>{{ t(next()!.title) }} · {{ next()!.language }}</h2><p>{{ t(next()!.path) }} · {{ t('Nivel') }} {{ next()!.level }}</p><div class="reference-actions"><a class="button primary" [routerLink]="['/leccion', next()!.id]">{{ t('Comenzar') }}</a><a class="button secondary" routerLink="/ejercicios">{{ t('Ver ejercicios') }}</a></div><div class="reference-progress-label"><span>{{ completion() }}{{ t('% completado') }}</span><span>{{ data()?.streakDays ?? 0 }} {{ t('días de racha') }}</span></div><div class="progress-track" role="progressbar" [attr.aria-valuenow]="completion()" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="completion()"></span></div> }
        @else { <h3>{{ t('Conecta el servidor para comenzar') }}</h3> }
      </section>
      <section class="card reference-path"><div class="card-title-row"><h3>{{ t('Ruta de aprendizaje') }}</h3><span class="muted">{{ completion() }}%</span></div><div class="progress-track"><span [style.width.%]="completion()"></span></div>
        @for (path of paths; track path; let index = $index) { <div class="reference-path-row" [class.current]="path === currentPath()" [class.completed]="pathStatus(path, index) === 'Completado'"><span>{{ pathStatus(path, index) === 'Completado' ? '✓' : index + 1 }}</span><div><strong>{{ index + 1 }}. {{ t(path) }}</strong><small>{{ t(pathStatus(path, index)) }}</small></div></div> }
      </section>
    </div>
    <div class="dashboard-grid dashboard-secondary">
      <section class="card reference-activity"><div class="card-title-row"><h3>{{ t('Última actividad') }}</h3><a routerLink="/estadisticas">{{ t('Ver estadísticas') }} ›</a></div>
        @if (loading()) { <p class="muted">{{ t('Cargando actividad…') }}</p> } @else if (data()?.recentActivities?.length) { @for (activity of data()!.recentActivities; track activity.createdAt) { <div class="activity-row"><span>{{ t(activity.lesson.title) }} · {{ activity.lesson.language }}</span><strong>{{ activity.wpm.toFixed(0) }} WPM</strong></div> } } @else { <p class="muted activity-empty">{{ t('Cuando completes una lección, tus resultados aparecerán aquí.') }}</p> }
      </section>
      <section class="card reference-challenge"><div class="eyebrow">{{ t('RETO DIARIO') }}</div>@if (data()?.dailyChallenge; as challenge) { <h3>{{ t(challenge.title) }}</h3><p>{{ challenge.language }} · {{ t(challenge.path) }}</p><a class="button primary" [routerLink]="['/leccion', challenge.id]">{{ t('Jugar') }} ›</a> } @else { <h3>{{ t('Completa una lección para comenzar') }}</h3> }<div class="daily-goal"><div><span>{{ t('Meta diaria') }}</span><span>{{ Math.floor((data()?.todayPracticeMs ?? 0) / 60000) }} / {{ data()?.dailyGoalMinutes ?? 20 }} {{ t('min') }}</span></div><div class="progress-track"><span [style.width.%]="goalProgress()"></span></div></div></section>
    </div>
  `,
})
export class DashboardPageComponent {
  private readonly http = inject(HttpClient);
  readonly session = inject(SessionService);
  t(text: string): string { return translate(text, this.session.language()); }
  readonly data = signal<Dashboard | null>(null);
  readonly lessons = signal<Lesson[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly paths = ['Introducción', 'Condicionales', 'Bucles', 'Funciones'];
  readonly Math = Math;
  readonly name = signal('');
  readonly defaultLanguage = signal('Python');
  readonly next = () => this.lessons().find((lesson) => lesson.status === 'in_progress' && lesson.language === this.defaultLanguage()) ?? this.lessons().find((lesson) => lesson.status === 'in_progress') ?? this.lessons().find((lesson) => lesson.status !== 'locked' && lesson.language === this.defaultLanguage()) ?? this.lessons().find((lesson) => lesson.status !== 'locked') ?? null;
  readonly currentPath = () => this.next()?.path ?? this.paths[0];
  readonly completion = () => this.lessons().length ? Math.round(this.lessons().filter((lesson) => lesson.status === 'completed').length / this.lessons().length * 100) : 0;
  readonly goalProgress = () => Math.min(100, Math.round((this.data()?.todayPracticeMs ?? 0) / Math.max(1, (this.data()?.dailyGoalMinutes ?? 20) * 60000) * 100));
  pathStatus(path: string, index: number): string {
    const lessons = this.lessons().filter((lesson) => lesson.path === path);
    if (lessons.length && lessons.every((lesson) => lesson.status === 'completed')) return 'Completado';
    if (lessons.some((lesson) => lesson.status === 'in_progress')) return 'En curso';
    if (index === 0 || this.lessons().filter((lesson) => lesson.path === this.paths[index - 1]).every((lesson) => lesson.status === 'completed')) return 'Disponible';
    return 'Bloqueado';
  }

  constructor() {
    this.http.get<Dashboard>(`${API_URL}/dashboard`).subscribe({ next: (data) => { this.data.set(data); this.loading.set(false); }, error: () => { this.error.set('Inicia sesión para consultar tu progreso.'); this.loading.set(false); } });
    this.http.get<Lesson[]>(`${API_URL}/lessons`).subscribe({ next: (lessons) => this.lessons.set(lessons), error: () => this.loading.set(false) });
    effect(() => { if (this.session.token()) this.http.get<{ defaultLanguage: string }>(`${API_URL}/settings`).subscribe({ next: (settings) => this.defaultLanguage.set(settings.defaultLanguage), error: () => undefined }); });
    effect(() => { if (this.session.token()) this.http.get<{name: string}>(`${API_URL}/me`).subscribe({ next: (user) => this.name.set(user.name), error: () => undefined }); });
  }
}
