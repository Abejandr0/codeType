# Trabajo por ramas

Las funcionalidades se implementan en ramas `feature/<área>`, se validan antes de integrar y se conservan en GitHub como rastro de cada entrega. Los commits siguen Conventional Commits (`feat`, `fix`, `test`, `docs`, `build`).

## Migración Angular

| Rama | Alcance |
| --- | --- |
| `feature/angular-shell` | Angular 21, navegación, sesión y shell de escritorio |
| `feature/angular-lessons` | Catálogo, motor de tipeo y persistencia de intentos |
| `feature/angular-dashboard-stats` | Dashboard, estadísticas, gráficas y recomendaciones |
| `feature/angular-battle-social` | Socket.IO, matchmaking, amistades y rating |
| `feature/angular-settings` | Ajustes, perfil, limpieza React y documentación |
| `feature/angular-localization` | Traducciones ES/EN globales y preferencias de idioma aplicadas al iniciar sesión |

Las ramas son acumulativas: cada una parte de la anterior ya integrada en `main`. Para revisar una función, consultar los commits de su rama desde el merge base con `main`.
