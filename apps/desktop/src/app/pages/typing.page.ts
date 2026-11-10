import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API_URL, SessionService } from '../core/session.service';

@Component({ standalone: true, imports: [RouterLink], template: `
  <div class="lesson-toolbar"><a routerLink="/ejercicios" class="back-link">← Ejercicios</a></div>
  @if (loading()) { <section class="card">Cargando la lección…</section> }
  @else if (error()) { <section class="card empty-state"><h2>No se pudo abrir esta lección</h2><p>{{ error() }}</p></section> }
  @else if (lesson(); as item) { <div class="typing-session-header"><div><div class="eyebrow">PRÁCTICA DE CÓDIGO</div><h1>{{ item.title }}</h1><p>{{ item.path }} · Nivel {{ item.level }}</p></div><div class="typing-clock"><strong>{{ item.language }}</strong></div></div><section class="card typing-card"><pre>{{ item.code }}</pre><p>{{ item.tip }}</p><p class="inline-note">El editor de práctica se incorpora en la rama de lecciones.</p></section> }
` })
export class TypingPageComponent {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  readonly lesson = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  constructor() {
    effect(() => {
      const token = this.session.token();
      const id = this.route.snapshot.paramMap.get('id');
      if (!token || !id) return;
      this.http.get<any[]>(`${API_URL}/lessons`).subscribe({ next: (rows) => { this.lesson.set(rows.find((row) => row.id === id) ?? null); if (!rows.some((row) => row.id === id)) this.error.set('No encontramos esa lección.'); this.loading.set(false); }, error: () => { this.error.set('No se pudo consultar el contenido.'); this.loading.set(false); } });
    });
  }
}
