import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { SessionService } from './session.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionService);
  const tokenAtRequest = session.token();
  const authEndpoint = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout']
    .some((path) => request.url.includes(path));
  const withSession = (token: string | null) => token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` }, withCredentials: true })
    : request.clone({ withCredentials: true });

  return next(withSession(tokenAtRequest)).pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401 || authEndpoint) {
      return throwError(() => error);
    }

    const currentToken = session.token();
    if (!currentToken) return throwError(() => error);
    if (currentToken !== tokenAtRequest) return next(withSession(currentToken));

    return from(session.refreshAfterUnauthorized()).pipe(
      switchMap(() => {
        const renewedToken = session.token();
        return renewedToken ? next(withSession(renewedToken)) : throwError(() => error);
      }),
      catchError((refreshError: unknown) => throwError(() => refreshError)),
    );
  }));
};
