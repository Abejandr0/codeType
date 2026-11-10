import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_URL, SessionService } from '../core/session.service';
import { translate } from '../core/translation';

interface Lesson { id: string; title: string; language: string; path: string; level: number; code: string; status: 'locked' | 'in_progress' | 'completed'; minAccuracy: number }

@Component({ standalone: true, imports: [RouterLink], template: `
  <header class="page-heading"><div><div class="eyebrow">{{ t('RUTAS DE APRENDIZAJE') }}</div><h1>{{ t('Ejercicios') }}</h1><p>{{ t('Aprende fundamentos practicando código real, tecla a tecla.') }}</p></div></header>
  @if (loading()) { <section class="card">{{ t('Cargando lecciones…') }}</section> }
  @else if (error()) { <section class="card empty-state"><h3>{{ t('No se pudo cargar el contenido') }}</h3><p>{{ t(error()) }}</p></section> }
  @else if (lessons().length === 0) { <section class="card empty-state"><h3>{{ t('No hay lecciones disponibles') }}</h3><p>{{ t('Vuelve a cargar las lecciones con') }} <code>npm run seed</code>.</p></section> }
  @else { <div class="lesson-grid">@for (lesson of visibleLessons(); track lesson.id) { <a [routerLink]="lesson.status === 'locked' ? null : ['/leccion', lesson.id]" [attr.aria-disabled]="lesson.status === 'locked'" (click)="lesson.status === 'locked' && $event.preventDefault()"><section class="card lesson-card"><div class="lesson-card-top"><span class="language-tag">{{ lesson.language }}</span><span class="muted">{{ t('Nivel') }} {{ lesson.level }}</span></div><div class="eyebrow">{{ t(lesson.path) }}</div><h3>{{ t(lesson.title) }}</h3><pre>{{ lesson.code }}</pre><div class="lesson-card-foot"><span>{{ lesson.status === 'locked' ? t('Completa la ruta anterior') : lesson.status === 'completed' ? t('Completada') : t('Precisión mínima ') + lesson.minAccuracy + '%' }}</span><span class="button secondary" [class.disabled]="lesson.status === 'locked'">{{ lesson.status === 'locked' ? t('Bloqueada') : lesson.status === 'completed' ? t('Repetir') : t('Practicar') }} ›</span></div></section></a> }</div> }
` })
export class ExercisesPageComponent {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  t(text: string): string { return translate(text, this.session.language()); }
  readonly lessons = signal<Lesson[]>([]);
  readonly defaultLanguage = signal('Python');
  readonly visibleLessons = computed(() => [...this.lessons()].sort((first, second) => Number(second.language === this.defaultLanguage()) - Number(first.language === this.defaultLanguage())));
  readonly loading = signal(true);
  readonly error = signal('');
  constructor() {
    effect(() => {
      if (!this.session.token()) return;
      this.loading.set(true);
      this.http.get<Lesson[]>(`${API_URL}/lessons`).subscribe({ next: (rows) => { this.lessons.set(rows); this.error.set(''); this.loading.set(false); }, error: (response) => { this.error.set(response.error?.error ?? 'Revisa la conexión con el servidor.'); this.loading.set(false); } });
      this.http.get<{ defaultLanguage: string }>(`${API_URL}/settings`).subscribe({ next: (settings) => this.defaultLanguage.set(settings.defaultLanguage), error: () => undefined });
    });
  }
}
