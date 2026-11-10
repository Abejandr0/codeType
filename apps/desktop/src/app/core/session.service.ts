import { HttpClient } from '@angular/common/http';
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

export const API_URL = 'http://localhost:3001';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly currentToken = signal<string | null>(null);
  private readonly currentUser = signal<SessionUser | null>(null);
  private readonly verified = signal(false);
  private readonly currentLanguage = signal<'ES' | 'EN'>('ES');
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

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
      const session = await firstValueFrom(
        this.http.post<SessionResponse>(`${API_URL}/auth/refresh`, {}),
      );
      this.setSession(session);
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
    try {
      await firstValueFrom(this.http.post(`${API_URL}/auth/logout`, {}));
    } finally {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.currentToken.set(null);
      this.currentUser.set(null);
      this.verified.set(true);
    }
  }

  private setSession(session: SessionResponse): void {
    this.currentToken.set(session.accessToken);
    this.currentUser.set(session.user);
    this.verified.set(true);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(async () => {
      try {
        const renewed = await firstValueFrom(this.http.post<SessionResponse>(`${API_URL}/auth/refresh`, {}));
        this.setSession(renewed);
      } catch {
        this.currentToken.set(null);
        this.currentUser.set(null);
        this.verified.set(true);
      }
    }, 14 * 60 * 1000);
  }
}
