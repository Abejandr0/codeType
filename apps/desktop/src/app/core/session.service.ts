import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  xp: number;
  rating: number;
}

interface SessionResponse {
  accessToken: string;
  user: SessionUser;
}

declare global {
  interface Window { CODETYPE_CONFIG?: { apiUrl?: string }; }
}

export const API_URL = window.CODETYPE_CONFIG?.apiUrl ?? 'http://localhost:3001';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly currentToken = signal<string | null>(null);
  private readonly currentUser = signal<SessionUser | null>(null);
  private readonly verified = signal(false);
  private readonly currentLanguage = signal<'ES' | 'EN'>('ES');
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshRequest: Promise<SessionResponse> | null = null;
  private sessionVersion = 0;
  private refreshFailures = 0;

  readonly token = this.currentToken.asReadonly();
  readonly user = this.currentUser.asReadonly();
  readonly checked = this.verified.asReadonly();
  readonly language = this.currentLanguage.asReadonly();

  setLanguage(language: 'ES' | 'EN'): void {
    this.currentLanguage.set(language);
    document.documentElement.lang = language.toLowerCase();
  }

  updateUser(user: SessionUser): void { this.currentUser.set(user); }

  constructor(private readonly http: HttpClient) {}

  async restore(): Promise<void> {
    try {
      this.setSession(await this.requestRefresh());
    } catch {
      this.verified.set(true);
    }
  }

  async authenticate(mode: 'login' | 'register', body: Record<string, string>): Promise<void> {
    const session = await firstValueFrom(
      this.http.post<SessionResponse>(`${API_URL}/auth/${mode}`, body),
    );
    this.setSession(session);
  }

  async logout(): Promise<void> {
    this.clearSession();
    try {
      await firstValueFrom(this.http.post(`${API_URL}/auth/logout`, {}));
    } finally {
      this.verified.set(true);
    }
  }

  async refreshAfterUnauthorized(): Promise<void> {
    await this.renewSession();
  }

  private setSession(session: SessionResponse): void {
    this.sessionVersion++;
    this.refreshFailures = 0;
    this.currentToken.set(session.accessToken);
    this.currentUser.set(session.user);
    this.verified.set(true);
    this.scheduleRefresh(13 * 60 * 1000);
  }

  private requestRefresh(): Promise<SessionResponse> {
    if (!this.refreshRequest) {
      this.refreshRequest = firstValueFrom(
        this.http.post<SessionResponse>(`${API_URL}/auth/refresh`, {}),
      ).finally(() => { this.refreshRequest = null; });
    }
    return this.refreshRequest;
  }

  private async renewSession(): Promise<void> {
    const version = this.sessionVersion;
    if (!this.currentToken()) throw new Error('No hay una sesión activa para renovar.');
    try {
      const renewed = await this.requestRefresh();
      if (version === this.sessionVersion && this.currentToken()) this.setSession(renewed);
    } catch (error) {
      if (version === this.sessionVersion) {
        if (error instanceof HttpErrorResponse && error.status === 401) this.clearSession();
        else this.scheduleRefreshRetry();
      }
      throw error;
    }
  }

  private scheduleRefresh(delayMs: number): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (!this.currentToken()) { this.refreshTimer = undefined; return; }
    this.refreshTimer = setTimeout(() => {
      void this.renewSession().catch(() => undefined);
    }, delayMs);
  }

  private scheduleRefreshRetry(): void {
    this.refreshFailures++;
    const delayMs = Math.min(60_000, 5_000 * 2 ** Math.min(this.refreshFailures - 1, 4));
    this.scheduleRefresh(delayMs);
  }

  private clearSession(): void {
    this.sessionVersion++;
    this.refreshFailures = 0;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    this.currentToken.set(null);
    this.currentUser.set(null);
  }
}
