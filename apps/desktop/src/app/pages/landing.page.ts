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
    <div class="landing-page studio-home">
      <header class="studio-topbar">
        <a class="brand landing-brand" routerLink="/" aria-label="CodeType, inicio">
          <span class="brand-mark" aria-hidden="true">ct</span><span>Code<span class="brand-accent">Type</span></span>
        </a>
        <div class="studio-topline"><i aria-hidden="true"></i>{{ t('LABORATORIO DE MECANOGRAFÍA') }}<span>BOG / 001</span></div>
        <nav aria-label="Navegación de inicio"><a href="#metodo">{{ t('El método') }}</a><a href="#rutas">{{ t('Rutas') }}</a></nav>
        <div class="studio-account"><a routerLink="/acceso" [queryParams]="{ mode: 'login' }">{{ t('Iniciar sesión') }}</a><a class="studio-account-join" routerLink="/acceso" [queryParams]="{ mode: 'register' }">{{ t('Entrar al estudio') }} <span aria-hidden="true">↗</span></a></div>
      </header>

      <main>
        <section class="studio-cover" aria-labelledby="landing-title">
          <div class="cover-meta"><span>01 <i>/</i> 03</span><span>{{ t('CÓDIGO · RITMO · PRECISIÓN') }}</span><span>{{ t('PYTHON + JAVASCRIPT') }}</span></div>
          <div class="cover-body">
            <div class="cover-headline"><p class="studio-kicker">{{ t('APRENDER TAMBIÉN ES ENTRENAR LAS MANOS') }}</p><h1 id="landing-title">{{ t('Tus manos también') }}<br><em>{{ t('aprenden a programar.') }}</em></h1></div>
            <div class="cover-note"><span class="note-index">[ 01 — 04 ]</span><p>{{ t('Escribe código real. Descubre lo que hace. Repite hasta que las teclas dejen de ser un obstáculo.') }}</p><a class="studio-start" routerLink="/acceso" [queryParams]="{ mode: 'register' }">{{ t('Abrir mi espacio') }} <span aria-hidden="true">↗</span></a></div>
          </div>
          <div class="cover-baseline"><span>{{ t('PRÁCTICA DE CÓDIGO') }}</span><span>↓ {{ t('DESLIZA PARA PRACTICAR') }}</span><span>CODETYPE®</span></div>
        </section>

        <section class="typing-floor" aria-labelledby="floor-title">
          <div class="floor-head"><div><span class="floor-index">02 / {{ t('ÁREA DE PRÁCTICA') }}</span><h2 id="floor-title">{{ t('Una línea. Una tecla. Tu ritmo.') }}</h2></div><span class="floor-tag"><i aria-hidden="true"></i>{{ t('MUESTRA DE LECCIÓN') }}</span></div>
          <div class="floor-workspace">
            <div class="floor-margin"><span class="margin-big">01</span><span class="margin-label">{{ t('EJERCICIO') }}<br>PY / JS</span><span class="margin-bracket" aria-hidden="true">⌜</span></div>
            <div class="floor-code-area">
              @if (catalog()?.featuredLesson; as lesson) {
                <div class="floor-code-title"><span>{{ lesson.language }} <i>·</i> {{ t(lesson.title) }}</span><span>{{ t('FRAGMENTO') }} 001</span></div>
                <pre>{{ lesson.code }}<span class="floor-cursor" aria-hidden="true"></span></pre>
              } @else {
                <div class="floor-code-title"><span>PYTHON <i>·</i> {{ t('PRIMEROS PASOS') }}</span><span>{{ t('FRAGMENTO') }} 001</span></div>
                <pre>print("Hola, mundo")<span class="floor-cursor" aria-hidden="true"></span></pre>
              }
              <div class="floor-annotation"><span class="annotation-line"></span><span>{{ t('Cada ejercicio explica el código que estás escribiendo.') }}</span></div>
            </div>
            <div class="floor-score"><span>{{ t('TU OBJETIVO') }}</span><strong>0<span>/</span>100</strong><small>{{ t('Precisión primero') }}</small><div class="score-ticks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
          </div>
          <div class="keyboard-deck" aria-hidden="true">
            <div class="keyboard-caption"><span>{{ t('MAPA DE TECLAS') }}</span><span>{{ t('FAMILIARÍZATE CON LOS SÍMBOLOS') }}</span><span>01—05</span></div>
            @for (row of keyboardRows; track $index) {
              <div class="keyboard-row">@for (key of row; track $index) { <kbd [class.key-wide]="key.length > 1" [class.key-space]="key === 'space'">{{ key === 'space' ? '' : key }}</kbd> }</div>
            }
          </div>
          <div class="floor-foot"><span>{{ t('EL CATÁLOGO SE ACTUALIZA CON CADA LECCIÓN') }}</span><span aria-live="polite">
            @if (catalogLoading()) { {{ t('Cargando…') }} }
            @else if (catalogError()) { {{ t('Catálogo no disponible') }} · <button type="button" (click)="loadCatalog()">{{ t('Reintentar') }}</button> }
            @else if (catalog(); as data) { {{ data.lessonCount }} {{ t('lecciones') }} · {{ data.routes.length }} {{ t('rutas') }} · {{ data.languages.join(' / ') }} }
          </span></div>
        </section>

        <section class="method-index" id="metodo" aria-labelledby="method-title">
          <div class="method-index-top"><span>03 / {{ t('EL MÉTODO') }}</span><span>{{ t('UNA PRÁCTICA CON INTENCIÓN') }}</span></div>
          <div class="method-index-heading"><h2 id="method-title">{{ t('Programar se vuelve natural cuando escribirlo también lo es.') }}</h2><p>{{ t('CodeType une fundamentos de programación con entrenamiento de precisión, velocidad y comprensión.') }}</p></div>
          <div class="method-list">
            <article><span class="method-list-number">01</span><h3>{{ t('Mecanografía de código') }}</h3><p>{{ t('Entrena símbolos, espacios y estructuras que aparecen en cada lenguaje.') }}</p><span class="method-list-mark" aria-hidden="true">↗</span></article>
            <article><span class="method-list-number">02</span><h3>{{ t('Lecciones explicadas') }}</h3><p>{{ t('Comprende cada fragmento mientras fortaleces tu memoria muscular.') }}</p><span class="method-list-mark" aria-hidden="true">↗</span></article>
            <article><span class="method-list-number">03</span><h3>{{ t('Progreso medible') }}</h3><p>{{ t('Sigue tu velocidad, precisión, rachas y resultados de cada práctica.') }}</p><span class="method-list-mark" aria-hidden="true">↗</span></article>
          </div>
          <div class="method-endline"><span>CODETYPE / TRAINING LOG</span><a href="#rutas">{{ t('VER EL CATÁLOGO') }} ↑</a></div>
        </section>
      </main>

      <footer class="studio-footer" id="rutas"><a class="footer-wordmark" routerLink="/">Code<span>Type</span></a><span>{{ t('Una tecla a la vez. Un concepto más cerca.') }}</span><a routerLink="/acceso" [queryParams]="{ mode: 'register' }">{{ t('Crear cuenta') }} ↗</a></footer>
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
  readonly keyboardRows = [
    ['esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', '⌫'],
    ['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
    ['caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'enter'],
    ['shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'shift'],
    ['ctrl', 'fn', 'alt', 'space', 'alt', '←', '↓', '↑', '→'],
  ];

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
