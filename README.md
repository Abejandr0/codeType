# CodeType – Aprende a Programar

Monorepo TypeScript para aprender código mediante mecanografía. El renderer de escritorio usa Angular 21 y sigue como referencia el diseño entregado en `CodeType – Aprende a Programar.html`, con tokens compartidos y componentes reutilizables.

## Requisitos

- Node.js 20.19 o superior y npm (Angular 21 también soporta Node 22.12+ y 24+)
- Docker Compose

## Arranque local

1. Copia `.env.example` a `.env`; define dos secretos JWT distintos de al menos 32 caracteres.
2. Inicia PostgreSQL y Redis con `docker compose up -d`.
3. Instala paquetes: `npm install`.
4. Aplica las migraciones existentes: `npm run db:migrate` (usa `prisma migrate deploy`; crea nuevas migraciones con `npm run db:dev`).
5. Inserta o actualiza las lecciones: `npm run seed`.
6. Ejecuta `npm run dev`.

Angular CLI estará en `http://localhost:5173`, Fastify en `http://localhost:3001`. `npm run dev` abre el renderer Angular y la ventana Electron. En Linux, el lanzador usa el sandbox de namespaces de Chromium cuando está disponible. Si la distribución bloquea namespaces y no permite configurar el helper SUID sin privilegios, el modo local de desarrollo aplica `--no-sandbox` como alternativa; muestra un aviso y limita el servidor Angular a `127.0.0.1`. `contextIsolation` y `nodeIntegration: false` se mantienen, y los paquetes de producción no usan este lanzador. PostgreSQL se publica en el puerto local `5433`, Redis en `6380`; ambos conservan sus datos en volúmenes de Docker.

## Despliegue web con Docker

Compose levanta la interfaz Angular, Fastify, PostgreSQL y Redis. Solo publica el puerto web; API, base de datos y Redis quedan dentro de la red privada de Docker. Al iniciar, la API aplica migraciones y siembra el catálogo idempotente. PostgreSQL y Redis conservan sus datos en volúmenes.

1. Copia `.env.example` a `.env`.
2. Cambia `POSTGRES_PASSWORD` por una contraseña larga URL-safe y define dos secretos JWT aleatorios, distintos y de al menos 32 caracteres.
3. Para un dominio público, cambia `CLIENT_ORIGIN` por su origen HTTPS y coloca un proxy TLS delante del puerto configurado en `CODETYPE_WEB_PORT`.
4. Ejecuta `npm run deploy:up` y abre `http://localhost:8080` (o el puerto que configuraste).
5. Consulta los registros con `npm run deploy:logs`; para detener los servicios usa `npm run deploy:down`.

`CODETYPE_API_URL` queda vacío para que la web use el mismo origen y Nginx reenvíe API y Socket.IO. La interfaz Electron conserva `http://localhost:3001`; su flujo local no cambia.

## Comandos

- `npm run dev`: servidor y app Electron de desarrollo; Angular CLI sirve el renderer en `http://localhost:5173`.
- `npm run build`: compila renderer Angular y backend.
- `npm test`: Vitest para el motor de tipeo y las métricas compartidas.
- `npm run test:e2e`: Playwright (requiere PostgreSQL migrado y sembrado, `.env` y `npx playwright install chromium`).
- `npm run package:linux`, `npm run package:mac`, `npm run package:windows`: genera instaladores Electron en `apps/desktop/release` (macOS y Windows se empaquetan en su plataforma correspondiente).
- `npm run deploy:up`, `npm run deploy:logs`, `npm run deploy:down`: construye y opera el despliegue web en Docker Compose.
- `npm run db:migrate`: migraciones Prisma.
- `npm run seed`: seed idempotente de ejercicios Python/JavaScript.
- `docs/branching.md`: ramas funcionales y reglas de trazabilidad; `docs/architecture/angular-adr.md`: decisión de framework.

## Qué funciona

- Registro e inicio de sesión con argon2, access JWT y refresh JWT rotatorio en cookie httpOnly.
- PostgreSQL/Prisma con migraciones para usuarios, ajustes, lecciones, intentos, pulsaciones y batallas.
- Cuarenta lecciones sembradas: cinco por lenguaje y ruta para Python y JavaScript en Introducción, Condicionales, Bucles y Funciones; explicaciones específicas y progreso bloqueado por requisitos de aprobación.
- Práctica carácter a carácter, Enter, Tab, autoindentado, composición de teclas muertas, pegado bloqueado, métrica WPM/precisión y almacenamiento de cada pulsación validada en servidor.
- Dashboard guiado por el diseño adjunto, con racha según zona horaria, actividad reciente, avance de ruta, reto determinista por fecha y meta diaria calculada con intentos guardados.
- Matchmaking Socket.IO con cola, presencia y salas compartidas por Redis entre procesos, fragmento compartido, cuenta regresiva, progreso validado, reconexión breve, abandono, chat predefinido, persistencia de resultado y Elo.
- Solicitudes de amistad por correo, aceptación/rechazo, presencia online real y desafíos directos entre amistades conectadas.
- Estadísticas de sesiones, gráfica WPM/precisión, mapa de calor construido con errores de pulsaciones persistidas y ranking de palabras/símbolos de código que más cuestan; recomendaciones deterministas basadas en ese historial.
- Página inicial pública con información del catálogo consultada al servidor, tipografía local para uso sin conexión, formularios con campos requeridos y requisitos visibles, sesiones que se pueden pausar y entrada por composición para teclas muertas/layouts ES.
- Preferencias persistidas, edición real del perfil, interfaz ES/EN en el shell y todas las pantallas, distribución de teclado, tamaño de fuente, sonidos, meta diaria, notificaciones nativas en Electron, zona horaria, exportación JSON y borrado de cuenta/datos.

## Suposiciones

- Los idiomas de la interfaz cubren el flujo principal de las pantallas; los fragmentos de código y los nombres propios de los lenguajes se mantienen originales.
- La progresión desbloquea cada ruta cuando se aprueban las lecciones de ambos lenguajes de la ruta anterior.
- Socket.IO y Redis respaldan presencia, cola e invitaciones entre procesos; cada batalla mantiene su estado autoritativo en el proceso que la crea y persiste el resultado final en PostgreSQL.
- Los instaladores deben generarse en el sistema operativo destino para cumplir los requisitos de Electron Builder de cada plataforma.
