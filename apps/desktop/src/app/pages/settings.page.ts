import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { profileSchema, settingsSchema } from '@codetype/shared';
import { API_URL, SessionService } from '../core/session.service';

interface Preferences {
  interfaceLanguage: 'ES' | 'EN';
  keyboardLayout: 'ES' | 'LATAM' | 'US';
  defaultLanguage: 'Python' | 'JavaScript';
  editorFontSize: number;
  sounds: boolean;
  dailyGoalMinutes: number;
  notifications: boolean;
  timezone: string;
}

@Component({ standalone: true, imports: [FormsModule], template: `
  <header class="page-heading"><div><div class="eyebrow">{{ text('PREFERENCIAS', 'PREFERENCES') }}</div><h1>{{ text('Ajustes', 'Settings') }}</h1><p>{{ text('Configura tu perfil y el entorno de práctica.', 'Manage your profile and practice environment.') }}</p></div></header>
  @if (loading()) { <section class="card" role="status">{{ text('Cargando ajustes…', 'Loading settings…') }}</section> }
  @else if (error()) { <section class="card empty-state" role="alert"><p>{{ error() }}</p><button class="button secondary" (click)="load()">{{ text('Reintentar', 'Retry') }}</button></section> }
  @else {
    <section class="card settings-section"><div class="card-title-row"><div><h2>{{ text('Perfil y cuenta', 'Profile and account') }}</h2><p class="muted">{{ text('Estos datos identifican tu cuenta.', 'These details identify your account.') }}</p></div></div>
      <form class="settings-form" (ngSubmit)="saveProfile()"><label>{{ text('Nombre', 'Name') }}<input name="profileName" [(ngModel)]="name" required minlength="2" maxlength="60" autocomplete="name" /></label><label>{{ text('Correo electrónico', 'Email address') }}<input name="profileEmail" [(ngModel)]="email" required type="email" autocomplete="email" /></label><button class="button primary" type="submit" [disabled]="profileSaving()">{{ profileSaving() ? text('Guardando…', 'Saving…') : text('Guardar perfil', 'Save profile') }}</button></form>
      @if (profileMessage()) { <p class="inline-note" role="status">{{ profileMessage() }}</p> }
    </section>

    <section class="card settings-section"><div><h2>{{ text('Entorno de práctica', 'Practice environment') }}</h2><p class="muted">{{ text('Los cambios se aplican en tu siguiente práctica.', 'Changes apply to your next practice session.') }}</p></div>
      <form class="settings-form settings-grid" (ngSubmit)="savePreferences()">
        <label>{{ text('Idioma de la interfaz', 'Interface language') }}<select name="interfaceLanguage" [(ngModel)]="preferences.interfaceLanguage"><option value="ES">Español</option><option value="EN">English</option></select></label>
        <label>{{ text('Distribución del teclado', 'Keyboard layout') }}<select name="keyboardLayout" [(ngModel)]="preferences.keyboardLayout"><option value="ES">Español (España)</option><option value="LATAM">Español (Latinoamérica)</option><option value="US">English (US)</option></select></label>
        <label>{{ text('Lenguaje de programación predeterminado', 'Default programming language') }}<select name="defaultLanguage" [(ngModel)]="preferences.defaultLanguage"><option>Python</option><option>JavaScript</option></select></label>
        <label>{{ text('Tamaño de fuente del editor', 'Editor font size') }}<span class="inline-setting"><input name="editorFontSize" type="range" min="12" max="32" step="1" [(ngModel)]="preferences.editorFontSize" /><output>{{ preferences.editorFontSize }} px</output></span></label>
        <label>{{ text('Meta diaria de práctica', 'Daily practice goal') }}<span class="inline-setting"><input name="dailyGoalMinutes" type="number" min="5" max="240" step="5" [(ngModel)]="preferences.dailyGoalMinutes" /><span>min</span></span></label>
        <label>{{ text('Zona horaria', 'Time zone') }}<input name="timezone" [(ngModel)]="preferences.timezone" required maxlength="80" placeholder="America/Bogota" /></label>
        <label class="toggle-setting"><input name="sounds" type="checkbox" [(ngModel)]="preferences.sounds" />{{ text('Sonidos al escribir', 'Typing sounds') }}</label>
        <label class="toggle-setting"><input name="notifications" type="checkbox" [(ngModel)]="preferences.notifications" />{{ text('Notificaciones al completar una lección', 'Lesson completion notifications') }}</label>
        <div class="settings-actions"><button class="button primary" type="submit" [disabled]="saving()">{{ saving() ? text('Guardando…', 'Saving…') : text('Guardar ajustes', 'Save settings') }}</button></div>
      </form>
      @if (settingsMessage()) { <p class="inline-note" role="status">{{ settingsMessage() }}</p> }
    </section>

    <section class="card settings-section"><h2>{{ text('Tus datos', 'Your data') }}</h2><p class="muted">{{ text('Descarga una copia de tus datos o elimina la cuenta y su actividad.', 'Download a copy of your data or delete your account and its activity.') }}</p>
      <div class="settings-actions"><button class="button secondary" type="button" (click)="exportData()" [disabled]="exporting()">{{ exporting() ? text('Preparando exportación…', 'Preparing export…') : text('Exportar mis datos', 'Export my data') }}</button></div>
      @if (dataMessage()) { <p class="inline-note" role="status">{{ dataMessage() }}</p> }
      <div class="danger-zone"><h3>{{ text('Eliminar cuenta', 'Delete account') }}</h3><p>{{ text('La eliminación es permanente e incluye tus intentos, pulsaciones, solicitudes y rating.', 'Deletion is permanent and includes your attempts, keystrokes, requests, and rating.') }}</p>
        @if (!confirmDelete()) { <button class="button danger" type="button" (click)="confirmDelete.set(true)">{{ text('Eliminar mi cuenta', 'Delete my account') }}</button> }
        @else { <form class="settings-form delete-confirm" (ngSubmit)="deleteAccount()"><label>{{ text('Escribe ELIMINAR para confirmar', 'Type DELETE to confirm') }}<input name="deleteConfirmation" [(ngModel)]="deleteConfirmation" required autocomplete="off" /></label><div class="settings-actions"><button class="button danger" type="submit" [disabled]="deleting() || !deleteConfirmed()">{{ deleting() ? text('Eliminando…', 'Deleting…') : text('Confirmar eliminación', 'Confirm deletion') }}</button><button class="button secondary" type="button" (click)="cancelDelete()">{{ text('Cancelar', 'Cancel') }}</button></div></form> }
      </div>
    </section>
  }
` })
export class SettingsPageComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly session = inject(SessionService);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly profileSaving = signal(false);
  readonly exporting = signal(false);
  readonly deleting = signal(false);
  readonly confirmDelete = signal(false);
  readonly deleteConfirmed = () => this.deleteConfirmation.trim().toUpperCase() === (this.session.language() === 'ES' ? 'ELIMINAR' : 'DELETE');
  readonly settingsMessage = signal('');
  readonly profileMessage = signal('');
  readonly dataMessage = signal('');
  name = '';
  email = '';
  deleteConfirmation = '';
  preferences: Preferences = this.defaultPreferences();
  private loaded = false;

  constructor() { effect(() => { const token = this.session.token(); if (token && !this.loaded) { this.loaded = true; void this.load(); } }); }

  text(spanish: string, english: string): string { return this.session.language() === 'ES' ? spanish : english; }

  async load(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try {
      const [preferences, profile] = await Promise.all([
        firstValueFrom(this.http.get<Preferences>(`${API_URL}/settings`)),
        firstValueFrom(this.http.get<any>(`${API_URL}/me`)),
      ]);
      this.preferences = this.pickPreferences(preferences);
      this.name = profile.name;
      this.email = profile.email;
      this.session.setLanguage(this.preferences.interfaceLanguage);
    } catch (error) { this.error.set(this.errorMessage(error, this.text('No se pudieron cargar tus ajustes.', 'Could not load your settings.'))); }
    finally { this.loading.set(false); }
  }

  async savePreferences(): Promise<void> {
    const parsed = settingsSchema.safeParse(this.preferences);
    if (!parsed.success) { this.settingsMessage.set(parsed.error.issues[0]?.message ?? this.text('Revisa los valores de tus ajustes.', 'Check your settings values.')); return; }
    this.saving.set(true); this.settingsMessage.set('');
    try {
      const saved = await firstValueFrom(this.http.patch<Preferences>(`${API_URL}/settings`, parsed.data));
      this.preferences = this.pickPreferences(saved);
      this.session.setLanguage(this.preferences.interfaceLanguage);
      this.settingsMessage.set(this.text('Ajustes guardados.', 'Settings saved.'));
    } catch (error) { this.settingsMessage.set(this.errorMessage(error, this.text('No se pudieron guardar los ajustes.', 'Could not save settings.'))); }
    finally { this.saving.set(false); }
  }

  async saveProfile(): Promise<void> {
    const parsed = profileSchema.safeParse({ name: this.name, email: this.email });
    if (!parsed.success) { this.profileMessage.set(parsed.error.issues[0]?.message ?? this.text('Revisa el perfil.', 'Check your profile.')); return; }
    this.profileSaving.set(true); this.profileMessage.set('');
    try {
      const response = await firstValueFrom(this.http.patch<{ user: any }>(`${API_URL}/me`, parsed.data));
      this.session.updateUser(response.user);
      this.name = response.user.name; this.email = response.user.email;
      this.profileMessage.set(this.text('Perfil actualizado.', 'Profile updated.'));
    } catch (error) { this.profileMessage.set(this.errorMessage(error, this.text('No se pudo actualizar el perfil.', 'Could not update profile.'))); }
    finally { this.profileSaving.set(false); }
  }

  async exportData(): Promise<void> {
    this.exporting.set(true); this.dataMessage.set('');
    try {
      const data = await firstValueFrom(this.http.get<Record<string, unknown>>(`${API_URL}/me/export`));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `codetype-datos-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
      URL.revokeObjectURL(url);
      this.dataMessage.set(this.text('Exportación descargada.', 'Export downloaded.'));
    } catch (error) { this.dataMessage.set(this.errorMessage(error, this.text('No se pudieron exportar tus datos.', 'Could not export your data.'))); }
    finally { this.exporting.set(false); }
  }

  async deleteAccount(): Promise<void> {
    if (!this.deleteConfirmed()) return;
    this.deleting.set(true); this.dataMessage.set('');
    try {
      await firstValueFrom(this.http.delete(`${API_URL}/me`));
      await this.session.logout();
      await this.router.navigateByUrl('/');
    } catch (error) { this.dataMessage.set(this.errorMessage(error, this.text('No se pudo eliminar la cuenta.', 'Could not delete the account.'))); }
    finally { this.deleting.set(false); }
  }

  cancelDelete(): void { this.confirmDelete.set(false); this.deleteConfirmation = ''; }
  private defaultPreferences(): Preferences { return { interfaceLanguage: 'ES', keyboardLayout: 'ES', defaultLanguage: 'Python', editorFontSize: 18, sounds: true, dailyGoalMinutes: 20, notifications: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota' }; }
  private pickPreferences(value: Partial<Preferences>): Preferences { const defaults = this.defaultPreferences(); return { interfaceLanguage: value.interfaceLanguage ?? defaults.interfaceLanguage, keyboardLayout: value.keyboardLayout ?? defaults.keyboardLayout, defaultLanguage: value.defaultLanguage ?? defaults.defaultLanguage, editorFontSize: value.editorFontSize ?? defaults.editorFontSize, sounds: value.sounds ?? defaults.sounds, dailyGoalMinutes: value.dailyGoalMinutes ?? defaults.dailyGoalMinutes, notifications: value.notifications ?? defaults.notifications, timezone: value.timezone ?? defaults.timezone }; }
  private errorMessage(error: unknown, fallback: string): string { return error instanceof HttpErrorResponse ? error.error?.error ?? fallback : fallback; }
}
