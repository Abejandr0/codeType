import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { loginSchema, registerSchema } from '@codetype/shared';
import { SessionService } from '../core/session.service';
import { translate } from '../core/translation';

@Component({
  selector: 'app-auth-panel',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <a class="brand auth-brand" routerLink="/" aria-label="Volver al inicio">
        <span class="brand-mark" aria-hidden="true">ct</span>
        <span>Code<span class="brand-accent">Type</span></span>
      </a>
      <section class="card auth-card" aria-labelledby="auth-heading">
        <p class="eyebrow">{{ t(mode() === 'register' ? 'COMIENZA TU RECORRIDO' : 'CONTINÚA TU RECORRIDO') }}</p>
        <h1 id="auth-heading">{{ t(mode() === 'register' ? 'Crea tu cuenta' : 'Qué bueno verte') }}</h1>
        <p class="auth-intro">{{ t('Tu progreso de mecanografía se guardará en tu cuenta.') }}</p>
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
          <button class="button primary auth-submit" type="submit" [disabled]="loading() || !authForm.valid">{{ loading() ? t('Conectando…') : mode() === 'register' ? t('Crear cuenta') : t('Iniciar sesión') }}</button>
          @if (message()) { <p class="auth-error" role="alert">{{ t(message()) }}</p> }
        </form>
        <button class="auth-switch" type="button" (click)="toggle()">{{ t(mode() === 'register' ? '¿Ya tienes cuenta? Inicia sesión' : '¿Aún no tienes cuenta? Regístrate') }}</button>
      </section>
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
      if (this.session.user()) void this.router.navigateByUrl('/dashboard');
    });
  }

  t(text: string): string { return translate(text, this.session.language()); }

  toggle(): void {
    this.mode.update((mode) => mode === 'register' ? 'login' : 'register');
    this.message.set('');
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
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      const response = error as HttpErrorResponse;
      this.message.set(response.error?.error ?? 'No se pudo completar el inicio de sesión.');
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
}
