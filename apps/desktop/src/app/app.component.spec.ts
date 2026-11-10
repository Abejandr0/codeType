import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppComponent } from './app.component';
import { authTokenInterceptor } from './core/auth.interceptor';

describe('AppComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders navigation and restores the session from the refresh cookie', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const refresh = http.expectOne('http://localhost:3001/auth/refresh');
    expect(refresh.request.withCredentials).toBe(true);
    refresh.flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('CodeType');
    expect(root.textContent).toContain('Dashboard');
    expect(root.querySelectorAll('nav a').length).toBe(5);
  });
});
