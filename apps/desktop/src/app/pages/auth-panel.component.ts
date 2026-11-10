import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { loginSchema, registerSchema } from '@codetype/shared';
import { SessionService } from '../core/session.service';

@Component({
  selector: 'app-auth-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-backdrop">
      <section class="card auth-card" aria-labelledby="auth-heading">
        <div class="brand auth-brand"><span class="brand-mark">&lt;/&gt;</span><span>Code<span class="brand-accent">Type</span></span></div>
        <h2 id="auth-heading">{{ mode() === 'register' ? 'Crea tu cuenta' : 'Qué bueno verte' }}</h2>
        <p>Tu progreso de mecanografía se guardará en tu cuenta.</p>
        <form (ngSubmit)="submit()">
          @if (mode() === 'register') { <label>Nombre<input name="name" [(ngModel)]="name" required minlength="2" autocomplete="name" /></label> }
          <label>Correo electrónico<input name="email" type="email" [(ngModel)]="email" required autocomplete="email" /></label>
          <label>Contraseña<input name="password" type="password" [(ngModel)]="password" required [minlength]="mode() === 'register' ? 10 : 1" [autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'" /></label>
          <button class="button primary" type="submit" [disabled]="loading()">{{ loading() ? 'Conectando…' : mode() === 'register' ? 'Crear cuenta' : 'Iniciar sesión' }}</button>
          @if (message()) { <p class="auth-error" role="alert">{{ message() }}</p> }
        </form>
        <button class="auth-switch" type="button" (click)="toggle()">{{ mode() === 'register' ? '¿Ya tienes cuenta? Inicia sesión' : '¿Aún no tienes cuenta? Regístrate' }}</button>
      </section>
    </div>
  `,
})
export class AuthPanelComponent {
  private readonly session = inject(SessionService);
  readonly mode = signal<'login' | 'register'>('register');
  readonly message = signal('');
  readonly loading = signal(false);
  name = '';
  email = '';
  password = '';

  toggle(): void {
    this.mode.update((mode) => mode === 'register' ? 'login' : 'register');
    this.message.set('');
  }

  async submit(): Promise<void> {
    const schema = this.mode() === 'register' ? registerSchema : loginSchema;
    const parsed = schema.safeParse({ name: this.name, email: this.email, password: this.password });
    if (!parsed.success) {
      this.message.set(parsed.error.issues[0]?.message ?? 'Revisa los datos del formulario.');
      return;
    }
    this.loading.set(true);
    this.message.set('');
    try {
      await this.session.authenticate(this.mode(), parsed.data);
    } catch (error) {
      const response = error as HttpErrorResponse;
      this.message.set(response.error?.error ?? 'No se pudo completar el inicio de sesión.');
    } finally {
      this.loading.set(false);
    }
  }
}
