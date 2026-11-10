import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from './core/session.service';
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

  get rank(): string {
    const xp = this.session.user()?.xp ?? 0;
    return xp >= 1000 ? 'Caballero' : xp >= 500 ? 'Jedi' : 'Padawan de Python';
  }

  ngOnInit(): void {
    void this.session.restore();
  }
}
