# Mini Sistema Bancario — Microservicios con NestJS

Proyecto de aprendizaje para interiorizar conceptos senior de Node.js/NestJS,
arquitectura de microservicios y Docker, recorriendo **todas** las etapas del
ciclo de vida de software: análisis, diseño, implementación, pruebas,
containerización y despliegue.

## Cómo trabajamos

Avanzamos **etapa por etapa**. Cada etapa produce artefactos (documentos y/o
código) que se revisan antes de pasar a la siguiente. El estado de avance
vive en [`docs/00-roadmap.md`](docs/00-roadmap.md).

## Estructura del repositorio (evolucionará)

```
mini-bank-microservices/
├── docs/                 # Análisis, decisiones de arquitectura, contratos
├── services/
│   ├── auth-service/            # :3001 registro, login, JWT
│   ├── accounts-service/        # :3002 cuentas, saldos, movimientos (+ API interna)
│   ├── transactions-service/    # :3003 depósitos, retiros, transferencias (saga)
│   └── notifications-service/   # consumidor de eventos (sin puerto HTTP)
├── gateway/              # :3000 API Gateway (BFF): único punto de entrada del cliente
├── libs/
│   ├── auth-shared/      # JWT strategy/guard compartidos
│   ├── shared-contracts/ # tipos de contratos, eventos y paginación
│   ├── http-client/      # cliente HTTP con timeout, reintentos y circuit breaker
│   └── messaging/        # publisher/consumer RabbitMQ (ack, DLQ)
└── docker-compose.yml    # Postgres x3 + RabbitMQ
```

## Etapa actual

**Etapa 10 — Testing** (parcial). Etapas 5 a 9 implementadas. Ver [`docs/00-roadmap.md`](docs/00-roadmap.md).

Artefactos previos: [`docs/01-analisis-dominio.md`](docs/01-analisis-dominio.md) ·
[`docs/02-arquitectura.md`](docs/02-arquitectura.md) ·
[`docs/03-requerimientos.md`](docs/03-requerimientos.md) ·
[`docs/comandos-docker.md`](docs/comandos-docker.md).

## Setup local

Cada servicio tiene su `.env.example`; copia cada uno a `.env`. `INTERNAL_API_KEY` y `JWT_SECRET`
deben coincidir donde se indica en esos archivos.

```bash
pnpm install
cp .env.example .env                  # credenciales de Postgres/RabbitMQ para docker compose
docker compose up -d                  # Postgres x3 + RabbitMQ (panel en :15672)

pnpm -r build                         # compila libs primero (orden topológico)

# Migraciones y cliente Prisma (por servicio con base de datos)
pnpm --filter @mini-bank/auth-service prisma:migrate
pnpm --filter @mini-bank/accounts-service prisma:migrate
pnpm --filter @mini-bank/transactions-service prisma:migrate

pnpm -r test
```

Arranque (una terminal por servicio): `pnpm --filter <paquete> start:dev` para auth-service,
accounts-service, transactions-service, notifications-service y gateway.

### Flujo de prueba manual (a través del gateway)

1. `POST /api/auth/register` y `POST /api/auth/login` → `accessToken`.
2. `POST /api/accounts` `{ "currency": "USD" }` (con `Authorization: Bearer ...`) para dos usuarios.
3. `POST /api/transactions/deposit` con header `Idempotency-Key` y `{ accountId, amount, currency }`.
4. `POST /api/transactions/transfer` con `Idempotency-Key`; el log de notifications-service muestra la notificación.
5. `GET /api/accounts/:id/overview` y `GET /api/transactions`.
