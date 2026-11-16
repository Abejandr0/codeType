import { Routes } from '@angular/router';
import { DashboardPageComponent } from './pages/dashboard.page';
import { ExercisesPageComponent } from './pages/exercises.page';
import { TypingPageComponent } from './pages/typing.page';
import { BattlePageComponent } from './pages/battle.page';
import { StatisticsPageComponent } from './pages/statistics.page';
import { SettingsPageComponent } from './pages/settings.page';
import { AuthPanelComponent } from './pages/auth-panel.component';
import { EntryPageComponent } from './pages/entry.page';
import { requireSession } from './core/session.guard';

export const appRoutes: Routes = [
  { path: '', component: EntryPageComponent, title: 'CodeType · Inicio' },
  { path: 'acceso', component: AuthPanelComponent, title: 'CodeType · Tu cuenta' },
  { path: 'dashboard', component: DashboardPageComponent, canActivate: [requireSession], title: 'CodeType · Panel' },
  { path: 'ejercicios', component: ExercisesPageComponent, canActivate: [requireSession], title: 'CodeType · Ejercicios' },
  { path: 'leccion/:id', component: TypingPageComponent, canActivate: [requireSession], title: 'CodeType · Práctica' },
  { path: 'batalla', component: BattlePageComponent, canActivate: [requireSession], title: 'CodeType · Batalla 1v1' },
  { path: 'estadisticas', component: StatisticsPageComponent, canActivate: [requireSession], title: 'CodeType · Estadísticas' },
  { path: 'ajustes', component: SettingsPageComponent, canActivate: [requireSession], title: 'CodeType · Ajustes' },
  { path: '**', redirectTo: '' },
];
