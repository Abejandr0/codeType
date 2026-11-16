import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { loginSchema, registerSchema } from '@codetype/shared';
import { SessionService } from '../core/session.service';
import { translate } from '../core/translation';

@Component({
  selector: 'app-auth-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-page">
      <aside class="auth-story" aria-labelledby="story-title">
        <div class="auth-story-brand"><span class="brand-mark" aria-hidden="true">ct</span><span>Code<span>Type</span></span><small>LAB / 001</small></div>
        <div class="auth-story-main">
          <p class="story-kicker">{{ t('APRENDER CÓDIGO, TECLA A TECLA') }}</p>
          <h2 id="story-title">{{ t('Programa con las manos.') }}<br><em>{{ t('Comprende cada línea.') }}</em></h2>
          <p class="story-description">{{ t('CodeType enseña programación con ejercicios de escritura: practica código real, entiende sus instrucciones y mide cómo mejoras.') }}</p>
          <div class="story-demo" aria-hidden="true">
            <div class="story-demo-top"><span>PYTHON / 001</span><span>01—03</span></div>
            <div class="story-demo-code"><span>01</span><code>print(<b>"Hola, mundo"</b>)</code><i></i></div>
            <div class="story-demo-bottom"><span>{{ t('ESCRIBE') }}</span><span>{{ t('COMPRENDE') }}</span><span>{{ t('MEJORA') }}</span></div>
          </div>
          <div class="story-benefits">
            <div><span>01</span><p>{{ t('Lecciones de Python y JavaScript') }}</p></div>
            <div><span>02</span><p>{{ t('Velocidad y precisión por práctica') }}</p></div>
            <div><span>03</span><p>{{ t('Retos de código en vivo') }}</p></div>
          </div>
        </div>
        <div class="auth-story-foot"><span>CODETYPE / {{ t('ESTUDIO DE PROGRAMACIÓN') }}</span><span>BOG · CO</span></div>
      </aside>

      <main class="auth-form-side">
        <div class="auth-form-wrap">
          <div class="auth-form-context"><span class="context-dot"></span>{{ t('TU ESPACIO DE PRÁCTICA') }}<span>↗</span></div>
          <section class="auth-card" aria-labelledby="auth-heading">
            <p class="eyebrow">{{ t(mode() === 'register' ? 'COMIENZA TU RECORRIDO' : 'CONTINÚA TU RECORRIDO') }}</p>
            <h1 id="auth-heading">{{ t(mode() === 'register' ? 'Crea tu cuenta' : 'Qué bueno verte') }}</h1>
            <p class="auth-intro">{{ t(mode() === 'register' ? 'Crea tu espacio y guarda cada avance.' : 'Inicia sesión para continuar tu práctica.') }}</p>
            <p class="required-note">{{ t('Los campos con * son obligatorios.') }}</p>
            <form (ngSubmit)="submit()" #authForm="ngForm" novalidate>
              @if (mode() === 'register') {
                <label for="auth-name">{{ t('Nombre') }} <span class="required-marker">* {{ t('Obligatorio') }}</span></label>
                <input id="auth-name" name="name" [(ngModel)]="name" required minlength="2" maxlength="60" autocomplete="name" [attr.aria-describedby]="'name-help'" />
                <small id="name-help" class="field-hint">{{ t('De 2 a 60 caracteres.') }}</small>
              }
              <label for="auth-email">{{ t('Correo electrónico') }} <span class="required-marker">* {{ t('Obligatorio') }}</span></label>
              <input id="auth-email" name="email" type="email" [(ngModel)]="email" required maxlength="254" autocomplete="email" aria-describedby="email-help" />
              <small id="email-help" class="field-hint">{{ t('Usa un correo con formato nombre@dominio.com.') }}</small>
              <label for="auth-password">{{ t('Contraseña') }} <span class="required-marker">* {{ t('Obligatorio') }}</span></label>
              <input id="auth-password" name="password" type="password" [(ngModel)]="password" required [minlength]="mode() === 'register' ? 10 : 1" maxlength="128" [autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'" [attr.aria-describedby]="mode() === 'register' ? 'password-help' : null" />
              @if (mode() === 'register') { <small id="password-help" class="field-hint">{{ t('Usa entre 10 y 128 caracteres.') }}</small> }
              <button class="button primary auth-submit" type="submit" [disabled]="loading() || !authForm.valid">{{ loading() ? t('Conectando…') : mode() === 'register' ? t('Crear cuenta') : t('Iniciar sesión') }}<span aria-hidden="true">↗</span></button>
              @if (message()) { <p class="auth-error" role="alert">{{ t(message()) }}</p> }
            </form>
            <button class="auth-switch" type="button" (click)="toggle()">{{ t(mode() === 'register' ? '¿Ya tienes cuenta? Inicia sesión' : '¿Aún no tienes cuenta? Regístrate') }}</button>
          </section>
          <div class="auth-form-foot"><span>{{ t('Tu progreso se guarda en tu cuenta.') }}</span><span>CODETYPE®</span></div>
        </div>
      </main>
    </div>
  `,
})
export class AuthPanelComponent {
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly mode = signal<'login' | 'register'>(this.route.snapshot.queryParamMap.get('mode') === 'login' ? 'login' : 'register');
  readonly message = signal('');
  readonly loading = signal(false);
  name = '';
  email = '';
  password = '';

  constructor() {
    effect(() => {
      if (this.session.user()) void this.router.navigateByUrl(this.postAuthUrl());
    });
  }

  t(text: string): string { return translate(text, this.session.language()); }

  toggle(): void {
    const nextMode = this.mode() === 'register' ? 'login' : 'register';
    this.mode.set(nextMode);
    this.message.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { mode: nextMode },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  async submit(): Promise<void> {
    const mode = this.mode();
    const schema = mode === 'register' ? registerSchema : loginSchema;
    const parsed = schema.safeParse({ name: this.name, email: this.email, password: this.password });
    if (!parsed.success) {
      this.message.set(this.validationMessage(String(parsed.error.issues[0]?.path[0] ?? '')));
      return;
    }
    this.loading.set(true);
    this.message.set('');
    try {
      await this.session.authenticate(mode, parsed.data);
      await this.router.navigateByUrl(this.postAuthUrl());
    } catch (error) {
      this.message.set(this.authenticationError(error));
    } finally {
      this.loading.set(false);
    }
  }

  private validationMessage(field: string): string {
    if (field === 'name') return 'El nombre es obligatorio y debe tener entre 2 y 60 caracteres.';
    if (field === 'email') return 'Escribe un correo electrónico válido.';
    if (field === 'password') return this.mode() === 'register' ? 'La contraseña debe tener entre 10 y 128 caracteres.' : 'La contraseña es obligatoria.';
    return 'Revisa los datos del formulario.';
  }

  private authenticationError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No se pudo completar el inicio de sesión.';
    if (error.status === 429) return 'Demasiados intentos recientes. Espera un minuto y vuelve a intentarlo.';
    return error.error?.error ?? error.error?.message ?? 'No se pudo completar el inicio de sesión.';
  }

  private postAuthUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    return returnUrl?.startsWith('/') && !returnUrl.startsWith('//') && returnUrl !== '/acceso'
      ? returnUrl
      : '/dashboard';
  }
}
