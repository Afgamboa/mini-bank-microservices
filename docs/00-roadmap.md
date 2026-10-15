# Roadmap de aprendizaje

Marca cada etapa como la vayamos completando. El objetivo no es solo "que
funcione", sino entender **por qué** se toma cada decisión.

- [x] **Etapa 0 — Kickoff**: alcance, stack y modo de trabajo acordados.
- [x] **Etapa 1 — Análisis de dominio (DDD)**: bounded contexts, lenguaje
      ubicuo, agregados, eventos de dominio, event storming ligero.
- [x] **Etapa 2 — Diseño de arquitectura de microservicios**: mapa de
      contextos, contratos entre servicios (síncronos y eventos async),
      estrategia de datos (database-per-service), diagrama C4 (contenedores).
- [x] **Etapa 3 — Setup del monorepo y tooling**: gestor de paquetes,
      estructura de carpetas, linter/formatter compartido, `docker-compose`
      base con Postgres x N + RabbitMQ.
- [x] **Etapa 4 — Servicio Auth**: registro/login, JWT, hashing de passwords,
      guards, patrón "database per service".
- [ ] **Etapa 5 — Servicio Accounts**: apertura de cuentas, saldo,
      consistencia transaccional dentro del propio servicio.
- [ ] **Etapa 6 — Servicio Transactions**: transferencias, depósitos,
      retiros; **saga/orquestación** para consistencia entre servicios
      (sin transacciones distribuidas ACID).
- [ ] **Etapa 7 — Comunicación asíncrona (RabbitMQ)**: contratos de eventos,
      publishers/consumers con `@nestjs/microservices`, idempotencia,
      manejo de fallos (retry, dead-letter queue).
- [ ] **Etapa 8 — Servicio Notifications**: consumidor puro de eventos,
      patrón fire-and-forget.
- [ ] **Etapa 9 — API Gateway**: BFF en NestJS, agregación de respuestas,
      autenticación centralizada, rate limiting.
- [ ] **Etapa 10 — Testing**: unit tests, tests de integración con
      Testcontainers, e2e del flujo completo (transferencia entre cuentas).
- [ ] **Etapa 11 — Observabilidad**: logging estructurado, correlation IDs,
      health checks, métricas básicas (Prometheus), tracing (OpenTelemetry).
- [ ] **Etapa 12 — Dockerización completa**: Dockerfiles multi-stage,
      `docker-compose` para todo el sistema, variables de entorno y secretos.
- [ ] **Etapa 13 — CI/CD**: pipeline (GitHub Actions) — build, test, lint,
      build de imágenes, push a registry.
- [ ] **Etapa 14 — Despliegue**: opción simple (compose en una VM) y opción
      avanzada (Kubernetes) — se decide más adelante según tu interés.

## Decisiones ya acordadas (Etapa 0)

- **Servicios iniciales**: Auth, Accounts, Transactions, Notifications.
- **Comunicación**: híbrida — REST vía API Gateway para comandos/queries del
  cliente, eventos asíncronos (RabbitMQ) para comunicación entre servicios.
- **Persistencia**: _database per service_ (un Postgres por servicio).
- **Modo de trabajo**: etapa por etapa, con explicación de conceptos.
