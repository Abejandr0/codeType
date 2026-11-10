import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { API_URL, SessionService } from './core/session.service';
import { translate } from './core/translation';
import { AuthPanelComponent } from './pages/auth-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AuthPanelComponent],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  readonly session = inject(SessionService);
  readonly Math = Math;
  private readonly http = inject(HttpClient);

  get rank(): string {
    const xp = this.session.user()?.xp ?? 0;
    return translate(xp >= 1000 ? 'Caballero' : xp >= 500 ? 'Jedi' : 'Padawan de Python', this.session.language());
  }

  ngOnInit(): void {
    void this.session.restore().then(() => {
      if (this.session.token()) this.http.get<{ interfaceLanguage: 'ES' | 'EN' }>(`${API_URL}/settings`).subscribe({ next: (settings) => this.session.setLanguage(settings.interfaceLanguage), error: () => undefined });
    });
  }
}
