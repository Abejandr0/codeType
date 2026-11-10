import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { API_URL, SessionService } from '../core/session.service';

@Component({ standalone: true, template: `
  <header class="page-heading"><div><div class="eyebrow">PREFERENCIAS</div><h1>Ajustes</h1><p>Configura tu perfil y el entorno de práctica.</p></div></header>
  @if (loading()) { <section class="card">Cargando ajustes…</section> } @else if (error()) { <section class="card empty-state"><p>{{ error() }}</p></section> } @else if (settings(); as data) { <section class="card"><h3>Preferencias guardadas</h3><div class="stats-summary-grid"><div><span>Idioma</span><strong>{{ data.interfaceLanguage }}</strong></div><div><span>Teclado</span><strong>{{ data.keyboardLayout }}</strong></div><div><span>Lenguaje por defecto</span><strong>{{ data.defaultLanguage }}</strong></div><div><span>Meta diaria</span><strong>{{ data.dailyGoalMinutes }} min</strong></div></div></section> }
` })
export class SettingsPageComponent {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  readonly settings = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  constructor() { effect(() => { if (!this.session.token()) return; this.http.get<any>(`${API_URL}/settings`).subscribe({ next: (data) => { this.settings.set(data); this.loading.set(false); }, error: () => { this.error.set('No se pudieron cargar las preferencias.'); this.loading.set(false); } }); }); }
}
