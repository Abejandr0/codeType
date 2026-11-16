import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { API_URL, SessionService } from '../core/session.service';
import { translate } from '../core/translation';

interface CatalogSummary {
  lessonCount: number;
  languages: string[];
  routes: string[];
  featuredLesson: { title: string; language: string; code: string } | null;
}

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="landing-page">
      <header class="landing-nav">
        <a class="brand landing-brand" routerLink="/" aria-label="CodeType, inicio">
          <span class="brand-mark" aria-hidden="true">&lt;/&gt;</span>
          <span>Code<span class="brand-accent">Type</span></span>
        </a>
        <nav aria-label="Navegación de inicio">
          <a href="#como-funciona">{{ t('Cómo funciona') }}</a>
          <a href="#contenido">{{ t('Contenido') }}</a>
        </nav>
        <div class="landing-actions">
          <a class="landing-login" routerLink="/acceso" [queryParams]="{ mode: 'login' }">{{ t('Iniciar sesión') }}</a>
          <a class="button primary" routerLink="/acceso" [queryParams]="{ mode: 'register' }">{{ t('Crear cuenta') }}</a>
        </div>
      </header>

      <section class="landing-hero">
        <div class="landing-copy">
          <p class="eyebrow">{{ t('APRENDE PROGRAMANDO') }}</p>
          <h1>{{ t('Aprende a programar, una tecla a la vez.') }}</h1>
          <p class="landing-lede">{{ t('Practica código real, entiende cada línea y mide tu progreso con ejercicios y duelos en vivo.') }}</p>
          <div class="landing-actions landing-hero-actions">
            <a class="button primary landing-cta" routerLink="/acceso" [queryParams]="{ mode: 'register' }">{{ t('Empieza gratis') }}<span aria-hidden="true">→</span></a>
            <a class="button secondary landing-cta" href="#como-funciona">{{ t('Explorar la plataforma') }}</a>
          </div>
          <div class="landing-proof" id="contenido" aria-live="polite">
            @if (catalogLoading()) { <span>{{ t('Consultando el catálogo…') }}</span> }
            @else if (catalogError()) { <span>{{ t('No se pudo consultar el catálogo.') }} <button type="button" (click)="loadCatalog()">{{ t('Reintentar') }}</button></span> }
            @else if (catalog(); as data) {
              <span><strong>{{ data.lessonCount }}</strong> {{ t('lecciones disponibles') }}</span>
              <span class="proof-divider" aria-hidden="true"></span>
              <span><strong>{{ data.routes.length }}</strong> {{ t('rutas') }}</span>
              <span class="proof-divider" aria-hidden="true"></span>
              <span>{{ data.languages.join(' · ') }}</span>
            }
          </div>
        </div>
        <div class="landing-visual" aria-hidden="true">
          <div class="visual-glow"></div>
          <div class="code-window">
            @if (catalog()?.featuredLesson; as lesson) {
              <div class="code-window-bar"><span></span><span></span><span></span><small>{{ lesson.language }} · {{ lesson.title }}</small></div>
              <pre>{{ lesson.code }}<span class="typing-caret"></span></pre>
              <div class="code-window-footer"><span>{{ t('Contenido real del catálogo') }}</span><span class="code-status"><i></i>{{ t('Listo para practicar') }}</span></div>
            } @else { <div class="catalog-empty">{{ t('El catálogo se está preparando.') }}</div> }
          </div>
          <div class="floating-stat"><span class="stat-mark">WPM</span><div><strong>+ {{ t('Precisión') }}</strong><small>{{ t('Mide el avance de verdad') }}</small></div></div>
        </div>
      </section>

      <section class="landing-features" id="como-funciona">
        <article class="feature-card"><span class="feature-index">01</span><h2>{{ t('Escribe código real') }}</h2><p>{{ t('Practica ejemplos de Python y JavaScript con métricas por pulsación.') }}</p></article>
        <article class="feature-card"><span class="feature-index">02</span><h2>{{ t('Entiende lo que escribes') }}</h2><p>{{ t('Cada ejercicio explica qué hace el código y cómo se relacionan sus partes.') }}</p></article>
        <article class="feature-card"><span class="feature-index">03</span><h2>{{ t('Mejora con evidencia') }}</h2><p>{{ t('Revisa tu precisión, velocidad y los patrones que conviene practicar.') }}</p></article>
      </section>

      <footer class="landing-footer"><span>CodeType</span><span>{{ t('Aprendizaje de código con práctica deliberada.') }}</span><a routerLink="/acceso" [queryParams]="{ mode: 'register' }">{{ t('Crear una cuenta') }}</a></footer>
    </div>
  `,
})
export class LandingPageComponent {
  readonly session = inject(SessionService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly catalog = signal<CatalogSummary | null>(null);
  readonly catalogLoading = signal(true);
  readonly catalogError = signal(false);

  constructor() {
    effect(() => {
      if (this.session.user()) void this.router.navigateByUrl('/dashboard');
    });
    this.loadCatalog();
  }

  t(value: string): string { return translate(value, this.session.language()); }

  loadCatalog(): void {
    this.catalogLoading.set(true);
    this.catalogError.set(false);
    this.http.get<CatalogSummary>(`${API_URL}/catalog/summary`).subscribe({
      next: (summary) => { this.catalog.set(summary); this.catalogLoading.set(false); },
      error: () => { this.catalogError.set(true); this.catalogLoading.set(false); },
    });
  }
}
