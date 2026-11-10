import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_URL, SessionService } from '../core/session.service';

interface Lesson { id: string; title: string; language: string; path: string; level: number; code: string; status: 'locked' | 'in_progress' | 'completed' }
interface Dashboard { streakDays: number; xp: number; rating: number; dailyGoalMinutes: number; todayPracticeMs: number; dailyChallenge: Lesson | null; lastActivity: { wpm: number; accuracy: number; lesson: Lesson } | null; recentActivities: Array<{ wpm: number; createdAt: string; lesson: Lesson }> }

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="page-heading"><div><div class="eyebrow">TU ESPACIO DE APRENDIZAJE</div><h1>Panel de Inicio</h1><p>Continúa tu camino hacia la maestría del código{{ name() ? ', ' + name() : '.' }}</p></div><div class="header-streak">🔥 <b>Racha</b><strong>{{ data()?.streakDays ?? 0 }} días</strong></div></header>
    <div class="stats-grid dashboard-stats"><section class="card stat-card"><span class="muted">Última velocidad</span><strong>{{ data()?.lastActivity?.wpm ?? 0 }} <small>WPM</small></strong><span class="stat-foot">Última práctica guardada</span></section><section class="card stat-card"><span class="muted">Precisión reciente</span><strong>{{ data()?.lastActivity?.accuracy ?? 0 }}<small>%</small></strong><span class="stat-foot">En el último intento</span></section><section class="card stat-card"><span class="muted">Experiencia acumulada</span><strong>{{ data()?.xp ?? session.user()?.xp ?? 0 }} <small>XP</small></strong><span class="stat-foot">Nivel {{ Math.floor((data()?.xp ?? session.user()?.xp ?? 0) / 100) + 1 }}</span></section></div>
    <div class="dashboard-grid dashboard-primary">
      <section class="card next-card reference-next"><div class="eyebrow">SIGUIENTE LECCIÓN</div>
        @if (loading()) { <h3>Cargando lecciones…</h3> }
        @else if (error()) { <h3>No se pudieron cargar los datos</h3><p class="muted">{{ error() }}</p> }
        @else if (next()) { <h2>{{ next()!.title }} · {{ next()!.language }}</h2><p>{{ next()!.path }} · Nivel {{ next()!.level }}</p><div class="reference-actions"><a class="button primary" [routerLink]="['/leccion', next()!.id]">Comenzar</a><a class="button secondary" routerLink="/ejercicios">Ver ejercicios</a></div><div class="reference-progress-label"><span>{{ completion() }}% completado</span><span>{{ data()?.streakDays ?? 0 }} días de racha</span></div><div class="progress-track" role="progressbar" [attr.aria-valuenow]="completion()" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="completion()"></span></div> }
        @else { <h3>Conecta el servidor para comenzar</h3> }
      </section>
      <section class="card reference-path"><div class="card-title-row"><h3>Ruta de aprendizaje</h3><span class="muted">{{ completion() }}%</span></div><div class="progress-track"><span [style.width.%]="completion()"></span></div>
        @for (path of paths; track path; let index = $index) { <div class="reference-path-row" [class.current]="path === currentPath()" [class.completed]="pathStatus(path, index) === 'Completado'"><span>{{ pathStatus(path, index) === 'Completado' ? '✓' : index + 1 }}</span><div><strong>{{ index + 1 }}. {{ path }}</strong><small>{{ pathStatus(path, index) }}</small></div></div> }
      </section>
    </div>
    <div class="dashboard-grid dashboard-secondary">
      <section class="card reference-activity"><div class="card-title-row"><h3>Última actividad</h3><a routerLink="/estadisticas">Ver estadísticas ›</a></div>
        @if (loading()) { <p class="muted">Cargando actividad…</p> } @else if (data()?.recentActivities?.length) { @for (activity of data()!.recentActivities; track activity.createdAt) { <div class="activity-row"><span>{{ activity.lesson.title }} · {{ activity.lesson.language }}</span><strong>{{ activity.wpm.toFixed(0) }} WPM</strong></div> } } @else { <p class="muted activity-empty">Cuando completes una lección, tus resultados aparecerán aquí.</p> }
      </section>
      <section class="card reference-challenge"><div class="eyebrow">RETO DIARIO</div>@if (data()?.dailyChallenge; as challenge) { <h3>{{ challenge.title }}</h3><p>{{ challenge.language }} · {{ challenge.path }}</p><a class="button primary" [routerLink]="['/leccion', challenge.id]">Jugar ›</a> } @else { <h3>Completa una lección para comenzar</h3> }<div class="daily-goal"><div><span>Meta diaria</span><span>{{ Math.floor((data()?.todayPracticeMs ?? 0) / 60000) }} / {{ data()?.dailyGoalMinutes ?? 20 }} min</span></div><div class="progress-track"><span [style.width.%]="goalProgress()"></span></div></div></section>
    </div>
  `,
})
export class DashboardPageComponent {
  private readonly http = inject(HttpClient);
  readonly session = inject(SessionService);
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
