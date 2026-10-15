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
├── docs/                 # Análisis, decisiones de arquitectura (ADRs), contratos
├── services/             # Un microservicio NestJS por carpeta (aún no creado)
│   ├── auth-service/
│   ├── accounts-service/
│   ├── transactions-service/
│   └── notifications-service/
├── gateway/              # API Gateway (BFF) que expone REST al cliente
├── libs/                 # Código compartido (contratos de eventos, DTOs)
└── docker-compose.yml    # Orquestación local (Postgres x N, RabbitMQ, servicios)
```

## Etapa actual

**Etapa 5 — Servicio Accounts.** Ver [`docs/00-roadmap.md`](docs/00-roadmap.md).

Artefactos previos: [`docs/01-analisis-dominio.md`](docs/01-analisis-dominio.md) ·
[`docs/02-arquitectura.md`](docs/02-arquitectura.md) ·
[`docs/03-requerimientos.md`](docs/03-requerimientos.md) ·
[`docs/comandos-docker.md`](docs/comandos-docker.md).

`auth-service` ya implementa registro, login con JWT, hashing de passwords
y una ruta protegida de ejemplo (`GET /auth/getme`).

## Setup local

```bash
pnpm install
cp .env.example .env   # ajusta credenciales si quieres
docker compose up -d   # levanta Postgres x3 + RabbitMQ
pnpm lint
pnpm build
```
