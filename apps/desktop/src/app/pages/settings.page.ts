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
    <div class="settings-page-stack">
    <section class="card settings-section settings-profile-section"><div class="settings-section-heading"><span class="settings-section-mark" aria-hidden="true">01</span><div><h2>{{ text('Perfil y cuenta', 'Profile and account') }}</h2><p>{{ text('Estos datos identifican tu cuenta.', 'These details identify your account.') }}</p></div></div>
      <form class="settings-form" (ngSubmit)="saveProfile()"><label><span class="field-label">{{ text('Nombre', 'Name') }} <small>{{ text('Obligatorio', 'Required') }}</small></span><input name="profileName" [attr.aria-label]="text('Nombre', 'Name')" [(ngModel)]="name" required minlength="2" maxlength="60" autocomplete="name" /><small class="field-hint">{{ text('Entre 2 y 60 caracteres.', 'Between 2 and 60 characters.') }}</small></label><label><span class="field-label">{{ text('Correo electrónico', 'Email address') }} <small>{{ text('Obligatorio', 'Required') }}</small></span><input name="profileEmail" [attr.aria-label]="text('Correo electrónico', 'Email address')" [(ngModel)]="email" required type="email" autocomplete="email" /><small class="field-hint">{{ text('Usa una dirección de correo válida.', 'Enter a valid email address.') }}</small></label><button class="button primary" type="submit" [disabled]="profileSaving()">{{ profileSaving() ? text('Guardando…', 'Saving…') : text('Guardar perfil', 'Save profile') }}</button></form>
      @if (profileMessage()) { <p class="inline-note" role="status">{{ profileMessage() }}</p> }
    </section>

    <section class="card settings-section settings-preferences-section"><div class="settings-section-heading"><span class="settings-section-mark" aria-hidden="true">02</span><div><h2>{{ text('Entorno de práctica', 'Practice environment') }}</h2><p>{{ text('Personaliza el idioma, el teclado y tus metas.', 'Personalize the language, keyboard, and daily goal.') }}</p></div></div>
      <form class="settings-form settings-grid" (ngSubmit)="savePreferences()">
        <label><span class="field-label">{{ text('Idioma de la interfaz', 'Interface language') }}</span><select name="interfaceLanguage" [(ngModel)]="preferences.interfaceLanguage"><option value="ES">Español</option><option value="EN">English</option></select><small class="field-hint">{{ text('Cambia los textos de navegación y controles.', 'Changes navigation and control labels.') }}</small></label>
        <label><span class="field-label">{{ text('Distribución del teclado', 'Keyboard layout') }}</span><select name="keyboardLayout" [(ngModel)]="preferences.keyboardLayout"><option value="ES">Español (España)</option><option value="LATAM">Español (Latinoamérica)</option><option value="US">English (US)</option></select><small class="field-hint">{{ text('Ajusta las teclas resaltadas durante la práctica.', 'Updates highlighted keys during practice.') }}</small></label>
        <label><span class="field-label">{{ text('Lenguaje de programación predeterminado', 'Default programming language') }}</span><select name="defaultLanguage" [(ngModel)]="preferences.defaultLanguage"><option>Python</option><option>JavaScript</option></select><small class="field-hint">{{ text('Ordena primero las lecciones de este lenguaje.', 'Shows this language first in the lesson list.') }}</small></label>
        <label class="editor-size-control"><span class="field-label">{{ text('Tamaño de fuente del editor', 'Editor font size') }}</span><span class="inline-setting"><input name="editorFontSize" type="range" min="12" max="32" step="1" [ngModel]="preferences.editorFontSize" (ngModelChange)="setEditorFontSize($event)" [attr.aria-label]="text('Tamaño de fuente del editor', 'Editor font size')" [attr.aria-valuetext]="preferences.editorFontSize + ' px'" /><output>{{ preferences.editorFontSize }} px</output></span><small class="field-hint">{{ text('Vista previa en vivo. El cambio se aplica al guardar y abrir una práctica.', 'Live preview. The change applies after saving and opening a practice.') }}</small><pre class="editor-font-preview" [style.font-size.px]="preferences.editorFontSize">const saludo = "Hola";</pre></label>
        <label><span class="field-label">{{ text('Meta diaria de práctica', 'Daily practice goal') }}</span><span class="inline-setting"><input name="dailyGoalMinutes" type="number" min="5" max="240" step="5" [(ngModel)]="preferences.dailyGoalMinutes" /><span>{{ text('minutos', 'minutes') }}</span></span><small class="field-hint">{{ text('Entre 5 y 240 minutos al día.', 'Between 5 and 240 minutes per day.') }}</small></label>
        <label><span class="field-label">{{ text('Zona horaria', 'Time zone') }}</span><input name="timezone" [(ngModel)]="preferences.timezone" required maxlength="80" list="timezone-options" placeholder="America/Bogota" /><datalist id="timezone-options"><option value="America/Bogota"></option><option value="America/Mexico_City"></option><option value="America/Lima"></option><option value="America/Santiago"></option><option value="America/Argentina/Buenos_Aires"></option><option value="America/New_York"></option><option value="Europe/Madrid"></option><option value="Europe/London"></option><option value="UTC"></option></datalist><small class="field-hint">{{ text('Se usa para calcular tu racha, el reto diario y tu meta.', 'Used to calculate your streak, daily challenge, and goal.') }}</small></label>
        <label class="preference-toggle"><span class="preference-toggle-copy"><strong>{{ text('Sonidos al escribir', 'Typing sounds') }}</strong><small>{{ text('Un tono breve al acertar o equivocarte.', 'A brief tone for correct and incorrect keys.') }}</small></span><input name="sounds" type="checkbox" [(ngModel)]="preferences.sounds" /><span class="toggle-switch" aria-hidden="true"></span></label>
        <label class="preference-toggle"><span class="preference-toggle-copy"><strong>{{ text('Notificaciones de práctica', 'Practice notifications') }}</strong><small>{{ notificationHelp() }}</small></span><input name="notifications" type="checkbox" [ngModel]="preferences.notifications" (ngModelChange)="setNotificationsEnabled($event)" /><span class="toggle-switch" aria-hidden="true"></span></label>
        <div class="settings-actions"><button class="button primary" type="submit" [disabled]="saving()">{{ saving() ? text('Guardando…', 'Saving…') : text('Guardar ajustes', 'Save settings') }}</button></div>
      </form>
      @if (settingsMessage()) { <p class="inline-note" role="status">{{ settingsMessage() }}</p> }
    </section>

    <section class="card settings-section settings-data-section"><div class="settings-section-heading"><span class="settings-section-mark" aria-hidden="true">03</span><div><h2>{{ text('Tus datos', 'Your data') }}</h2><p>{{ text('Exporta una copia o administra tu cuenta.', 'Export a copy or manage your account.') }}</p></div></div>
      <p class="settings-data-description">{{ text('La exportación incluye el perfil, los intentos, las pulsaciones y el historial de batallas.', 'The export includes your profile, attempts, keystrokes, and battle history.') }}</p>
      <div class="settings-actions"><button class="button secondary" type="button" (click)="exportData()" [disabled]="exporting()">{{ exporting() ? text('Preparando exportación…', 'Preparing export…') : text('Exportar mis datos', 'Export my data') }}</button></div>
      @if (dataMessage()) { <p class="inline-note" role="status">{{ dataMessage() }}</p> }
      <div class="danger-zone"><h3>{{ text('Eliminar cuenta', 'Delete account') }}</h3><p>{{ text('La eliminación es permanente e incluye tus intentos, pulsaciones, solicitudes y rating.', 'Deletion is permanent and includes your attempts, keystrokes, requests, and rating.') }}</p>
        @if (!confirmDelete()) { <button class="button danger" type="button" (click)="confirmDelete.set(true)">{{ text('Eliminar mi cuenta', 'Delete my account') }}</button> }
        @else { <form class="settings-form delete-confirm" (ngSubmit)="deleteAccount()"><label>{{ text('Escribe ELIMINAR para confirmar', 'Type DELETE to confirm') }}<input name="deleteConfirmation" [(ngModel)]="deleteConfirmation" required autocomplete="off" /></label><div class="settings-actions"><button class="button danger" type="submit" [disabled]="deleting() || !deleteConfirmed()">{{ deleting() ? text('Eliminando…', 'Deleting…') : text('Confirmar eliminación', 'Confirm deletion') }}</button><button class="button secondary" type="button" (click)="cancelDelete()">{{ text('Cancelar', 'Cancel') }}</button></div></form> }
      </div>
    </section>
    </div>
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

  notificationHelp(): string {
    if (window.codeTypeDesktop?.notifyPracticeComplete) return this.text('Aviso al completar una lección en la app de escritorio.', 'Get a notification when you finish a lesson in the desktop app.');
    return this.text('Recibirás un aviso del navegador al guardar una práctica.', 'Your browser will notify you when a practice session is saved.');
  }

  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    if (enabled && !window.codeTypeDesktop?.notifyPracticeComplete) {
      if (!('Notification' in window)) {
        this.preferences = { ...this.preferences, notifications: false };
        this.settingsMessage.set(this.text('Este navegador no permite notificaciones.', 'This browser does not support notifications.'));
        return;
      }
      let permission: NotificationPermission = Notification.permission;
      if (permission === 'default') {
        try { permission = await Notification.requestPermission(); }
        catch { permission = 'denied'; }
      }
      if (permission !== 'granted') {
        this.preferences = { ...this.preferences, notifications: false };
        this.settingsMessage.set(this.text('Permite las notificaciones del navegador para activar esta opción.', 'Allow browser notifications to enable this option.'));
        return;
      }
    }
    this.preferences = { ...this.preferences, notifications: enabled };
    this.settingsMessage.set('');
  }

  setEditorFontSize(value: number | string): void {
    const size = Number(value);
    if (Number.isFinite(size)) this.preferences = { ...this.preferences, editorFontSize: Math.min(32, Math.max(12, Math.round(size))) };
  }

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
  private errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    const message = error.error?.error;
    return message === 'Sal de la batalla antes de eliminar tu cuenta.' ? this.text(message, 'Leave your battle before deleting your account.') : message ?? fallback;
  }
}
