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
          <span class="brand-mark" aria-hidden="true">ct</span>
          <span>Code<span class="brand-accent">Type</span></span>
        </a>
        <nav aria-label="Navegación de inicio">
          <a href="#metodo">{{ t('El método') }}</a>
          <a href="#rutas">{{ t('Rutas') }}</a>
        </nav>
        <div class="landing-actions">
          <a class="landing-login" routerLink="/acceso" [queryParams]="{ mode: 'login' }">{{ t('Iniciar sesión') }}</a>
          <a class="button primary nav-join" routerLink="/acceso" [queryParams]="{ mode: 'register' }">{{ t('Crear cuenta') }} <span aria-hidden="true">↗</span></a>
        </div>
      </header>

      <main>
        <section class="landing-hero" aria-labelledby="landing-title">
          <div class="landing-copy">
            <p class="landing-kicker"><span aria-hidden="true"></span>{{ t('UN ESTUDIO PARA APRENDER CÓDIGO') }}</p>
            <h1 id="landing-title">{{ t('Piensa en código.') }} <em>{{ t('Escribe con confianza.') }}</em></h1>
            <p class="landing-lede">{{ t('Entrena con fragmentos reales de Python y JavaScript. Cada tecla cuenta, cada ejercicio te explica lo que estás construyendo.') }}</p>
            <div class="landing-actions landing-hero-actions">
              <a class="button primary landing-cta" routerLink="/acceso" [queryParams]="{ mode: 'register' }">{{ t('Comenzar a practicar') }}<span aria-hidden="true">↗</span></a>
              <a class="landing-text-link" href="#metodo">{{ t('Conoce el método') }} <span aria-hidden="true">↓</span></a>
            </div>
            <div class="landing-proof" id="rutas" aria-live="polite">
              @if (catalogLoading()) { <span class="catalog-note">{{ t('Preparando el catálogo…') }}</span> }
              @else if (catalogError()) { <span class="catalog-note">{{ t('No se pudo consultar el catálogo.') }} <button type="button" (click)="loadCatalog()">{{ t('Reintentar') }}</button></span> }
              @else if (catalog(); as data) {
                <div class="proof-stat"><strong>{{ data.lessonCount }}</strong><span>{{ t('lecciones listas') }}</span></div>
                <span class="proof-divider" aria-hidden="true"></span>
                <div class="proof-stat"><strong>{{ data.routes.length }}</strong><span>{{ t('rutas guiadas') }}</span></div>
                <span class="proof-divider" aria-hidden="true"></span>
                <div class="proof-languages"><span class="language-chip">JS</span><span class="language-chip">PY</span><span>{{ data.languages.join(' · ') }}</span></div>
              }
            </div>
          </div>

          <aside class="practice-sheet" aria-label="Vista previa de una sesión de práctica">
            <div class="sheet-topline"><span class="sheet-index">CODETYPE / 01</span><span class="sheet-label">{{ t('SESIÓN DE PRÁCTICA') }}</span><span class="sheet-live"><i></i>{{ t('VISTA PREVIA') }}</span></div>
            @if (catalog()?.featuredLesson; as lesson) {
              <div class="sheet-lesson"><div><span class="sheet-overline">{{ lesson.language }} · {{ t('LECCIÓN DESTACADA') }}</span><h2>{{ t(lesson.title) }}</h2></div><span class="sheet-arrow" aria-hidden="true">↗</span></div>
              <div class="sheet-code"><div class="sheet-code-caption"><span>{{ t('Fragmento para escribir') }}</span><span>PY · JS</span></div><pre>{{ lesson.code }}<span class="typing-caret"></span></pre></div>
            } @else {
              <div class="sheet-lesson"><div><span class="sheet-overline">PYTHON · {{ t('PRIMEROS PASOS') }}</span><h2>{{ t('Tu primera línea') }}</h2></div><span class="sheet-arrow" aria-hidden="true">↗</span></div>
              <div class="sheet-code"><div class="sheet-code-caption"><span>{{ t('Fragmento para escribir') }}</span><span>PY · JS</span></div><pre>print("Hola, mundo")<span class="typing-caret"></span></pre></div>
            }
            <div class="sheet-progress"><div><span>{{ t('Precisión de pulsación') }}</span><strong>98%</strong></div><div class="progress-track"><span style="width: 98%"></span></div></div>
            <div class="sheet-bottom"><div class="key-sequence" aria-hidden="true"><kbd>p</kbd><kbd>r</kbd><kbd>i</kbd><kbd>n</kbd><kbd>t</kbd></div><span>{{ t('Practica a tu propio ritmo') }}</span><span class="sheet-check" aria-hidden="true">✓</span></div>
          </aside>
        </section>

        <section class="method-section" id="metodo" aria-labelledby="method-title">
          <div class="method-heading"><p class="landing-kicker">{{ t('APRENDER HACIENDO') }}</p><h2 id="method-title">{{ t('De la primera tecla a escribir sin mirar.') }}</h2><p>{{ t('Una rutina sencilla para pasar de copiar código a entenderlo.') }}</p></div>
          <div class="method-steps">
            <article class="method-step"><span class="method-number">01</span><div class="step-glyph" aria-hidden="true">⌨</div><h3>{{ t('Escribe') }}</h3><p>{{ t('Transcribe código real y acostumbra tus manos a sus símbolos, espacios y ritmo.') }}</p><span class="step-rule"></span></article>
            <article class="method-step"><span class="method-number">02</span><div class="step-glyph" aria-hidden="true">f(x)</div><h3>{{ t('Comprende') }}</h3><p>{{ t('Descubre qué hace cada fragmento y cómo se conectan las ideas.') }}</p><span class="step-rule"></span></article>
            <article class="method-step"><span class="method-number">03</span><div class="step-glyph" aria-hidden="true">↗</div><h3>{{ t('Avanza') }}</h3><p>{{ t('Mira tu precisión, velocidad y evolución para elegir qué practicar después.') }}</p><span class="step-rule"></span></article>
          </div>
        </section>

        <section class="landing-invite" aria-label="Empieza con CodeType">
          <div><p class="landing-kicker">{{ t('TU PRÓXIMA LÍNEA EMPIEZA AQUÍ') }}</p><h2>{{ t('Una tecla a la vez.') }}</h2></div>
          <a class="button primary landing-cta" routerLink="/acceso" [queryParams]="{ mode: 'register' }">{{ t('Crear mi cuenta') }} <span aria-hidden="true">↗</span></a>
        </section>
      </main>

      <footer class="landing-footer"><a class="footer-wordmark" routerLink="/">Code<span>Type</span></a><span>{{ t('Práctica deliberada para programadores.') }}</span><a routerLink="/acceso" [queryParams]="{ mode: 'login' }">{{ t('Iniciar sesión') }} ↗</a></footer>
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
