# CodeType – Aprende a Programar

Monorepo TypeScript para aprender código mediante mecanografía. No había un canvas de diseño adjunto al iniciar esta implementación, así que la interfaz usa los tokens de respaldo del brief.

## Requisitos

- Node.js 20.6 o superior y npm
- Docker Compose

## Arranque local

1. Copia `.env.example` a `.env`; define dos secretos JWT distintos de al menos 32 caracteres.
2. Inicia PostgreSQL con `docker compose up -d postgres`.
3. Instala paquetes: `npm install`.
4. Aplica las migraciones existentes: `npm run db:migrate` (usa `prisma migrate deploy`; crea nuevas migraciones con `npm run db:dev`).
5. Inserta o actualiza las lecciones: `npm run seed`.
6. Ejecuta `npm run dev`.

Vite estará en `http://localhost:5173`, Fastify en `http://localhost:3001`. `npm run dev` abre Vite y la ventana Electron con `contextIsolation` y sandbox activos. PostgreSQL se publica en el puerto local `5433` para evitar chocar con una instalación local y conserva sus datos en el volumen `codetype_pg`.

## Comandos

- `npm run dev`: servidor y app Electron de desarrollo.
- `npm run build`: compila frontend y backend.
- `npm test`: Vitest para el motor de tipeo y las métricas compartidas.
- `npm run test:e2e`: Playwright (requiere PostgreSQL migrado y sembrado, `.env` y `npx playwright install chromium`).
- `npm run db:migrate`: migraciones Prisma.
- `npm run seed`: seed idempotente de ejercicios Python/JavaScript.

## Qué funciona

- Registro e inicio de sesión con argon2, access JWT y refresh JWT rotatorio en cookie httpOnly.
- PostgreSQL/Prisma con migraciones para usuarios, ajustes, lecciones, intentos, pulsaciones y batallas.
- Ocho lecciones sembradas: Python y JavaScript en Introducción, Condicionales, Bucles y Funciones; progreso bloqueado por requisitos de aprobación.
- Práctica carácter a carácter, Enter, Tab, autoindentado, composición de teclas muertas, pegado bloqueado, métrica WPM/precisión y almacenamiento de cada pulsación validada en servidor.
- Dashboard guiado por el diseño adjunto, con racha según zona horaria, actividad reciente, avance de ruta, reto determinista por fecha y meta diaria calculada con intentos guardados.
- Matchmaking Socket.IO real, fragmento compartido, cuenta regresiva, progreso validado, reconexión breve, abandono, chat predefinido, persistencia de resultado y Elo.
- Solicitudes de amistad por correo, aceptación/rechazo, presencia online real y desafíos directos entre amistades conectadas.
- Estadísticas de sesiones, gráfica WPM/precisión, mapa de errores por tecla y recomendación determinista basada en errores persistidos.
- Preferencias persistidas, distribución de teclado, tamaño de fuente, sonido, zona horaria, exportación JSON y borrado de cuenta/datos.

## Pendiente para completar el brief

La selección de idioma EN se guarda pero aún no traduce la interfaz; las notificaciones no están conectadas a un canal del sistema y la edición de perfil queda pendiente. La progresión desbloquea una ruta cuando se aprueban las lecciones de ambos lenguajes de la ruta anterior. La cola, la presencia y las sesiones activas viven en memoria de un proceso, aunque amistades, invitaciones aceptadas, resultados y Elo se persisten. El empaquetado de instaladores para macOS/Windows/Linux y un historial de rating más detallado quedan por completar.
