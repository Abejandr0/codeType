# ADR 0001: Angular para la aplicación de escritorio

- Estado: aceptado
- Fecha: 2026-11-10

## Contexto

El renderer de Electron se había implementado con React, pero el framework requerido para el producto es Angular. La arquitectura del servidor, Prisma, PostgreSQL, Socket.IO y Electron ya funciona y no depende del framework de interfaz.

## Decisión

Migrar el renderer a Angular 21 LTS con componentes standalone, Angular Router, HttpClient, RxJS y signals. El CLI de Angular sirve el renderer en desarrollo y genera el bundle de producción que carga Electron. La sesión vive en un servicio Angular; el access token permanece en memoria y el refresh token en cookie httpOnly.

Angular signals y RxJS reemplazan Zustand y TanStack Query, que están integrados a React y no son el estado idiomático de Angular. Los contratos Zod compartidos se conservan para validar entradas compatibles en el cliente y servidor. El backend y su API no cambian durante la migración.

## Consecuencias

- Cada área de interfaz tiene componentes y rutas standalone con responsabilidades pequeñas.
- Las consultas y mutaciones pasan por HttpClient y los interceptores centrales.
- Electron mantiene `contextIsolation`, sandbox y el preload existente.
- El diseño y los estilos compartidos se conservan; la interfaz se migra por áreas y se integra una rama validada a la vez.
