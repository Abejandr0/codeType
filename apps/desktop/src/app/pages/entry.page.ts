import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../core/session.service';

@Component({
  standalone: true,
  template: `
    <main class="startup-screen" role="status" aria-live="polite">
      <div class="brand-mark" aria-hidden="true">ct</div>
      <p>Abriendo CodeType…</p>
    </main>
  `,
})
export class EntryPageComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (!this.session.checked()) return;
      void this.router.navigateByUrl(this.session.user() ? '/dashboard' : '/acceso', { replaceUrl: true });
    });
  }
}
