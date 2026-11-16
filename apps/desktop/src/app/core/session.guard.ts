import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { SessionService } from './session.service';

export const requireSession: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);

  return toObservable(session.checked).pipe(
    filter((checked) => checked),
    take(1),
    map(() => session.token()
      ? true
      : router.createUrlTree(['/acceso'], { queryParams: { mode: 'login', returnUrl: state.url } })),
  );
};
