import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionService } from './session.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(SessionService).token();
  const authenticated = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` }, withCredentials: true })
    : request.clone({ withCredentials: true });
  return next(authenticated);
};
