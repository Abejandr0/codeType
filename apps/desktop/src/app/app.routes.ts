import { Routes } from '@angular/router';
import { DashboardPageComponent } from './pages/dashboard.page';
import { ExercisesPageComponent } from './pages/exercises.page';
import { TypingPageComponent } from './pages/typing.page';
import { BattlePageComponent } from './pages/battle.page';
import { StatisticsPageComponent } from './pages/statistics.page';
import { SettingsPageComponent } from './pages/settings.page';

export const appRoutes: Routes = [
  { path: '', component: DashboardPageComponent, title: 'CodeType · Inicio' },
  { path: 'ejercicios', component: ExercisesPageComponent, title: 'CodeType · Ejercicios' },
  { path: 'leccion/:id', component: TypingPageComponent, title: 'CodeType · Práctica' },
  { path: 'batalla', component: BattlePageComponent, title: 'CodeType · Batalla 1v1' },
  { path: 'estadisticas', component: StatisticsPageComponent, title: 'CodeType · Estadísticas' },
  { path: 'ajustes', component: SettingsPageComponent, title: 'CodeType · Ajustes' },
  { path: '**', redirectTo: '' },
];
