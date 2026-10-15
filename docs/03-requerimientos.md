# Requerimientos y alcance del sistema

Este documento fija **qué construimos y qué no**, para no desviarnos durante
la implementación. Cualquier cosa que no esté aquí como "dentro de alcance"
se considera fuera, salvo que decidamos explícitamente ampliarlo y
actualicemos este archivo.

## 1. Requerimientos funcionales

### 1.1 Auth

- RF-01: Un usuario puede registrarse con email + password.
- RF-02: Un usuario puede iniciar sesión y recibir un JWT.
- RF-03: El sistema hashea passwords (bcrypt/argon2), nunca se persiste ni
  se expone el password en texto plano.
- RF-04: Rutas protegidas del Gateway validan el JWT antes de reenviar la
  petición al servicio correspondiente.

### 1.2 Accounts

- RF-05: Un usuario autenticado puede abrir **una** cuenta de ahorro simple
  (un solo tipo de cuenta, una sola moneda por cuenta).
- RF-06: Un usuario puede consultar el saldo actual de su cuenta.
- RF-07: Un usuario puede consultar el historial de movimientos de su
  cuenta (lista paginada).
- RF-08: El saldo de una cuenta nunca queda negativo (sin sobregiro).
- RF-09: Toda mutación de saldo (débito/crédito) es idempotente respecto a
  una `reference` (id de transacción origen).

### 1.3 Transactions

- RF-10: Un usuario puede depositar dinero en su propia cuenta.
- RF-11: Un usuario puede retirar dinero de su propia cuenta (si hay saldo
  suficiente).
- RF-12: Un usuario puede transferir dinero de su cuenta a otra cuenta
  existente dentro del mismo sistema.
- RF-13: Si falla el crédito en la cuenta destino tras un débito exitoso en
  la cuenta origen, el sistema **compensa** (revierte el débito) — patrón
  Saga orquestada.
- RF-14: Cada transacción queda registrada de forma inmutable con su
  resultado final (`COMPLETED` / `FAILED`).

### 1.4 Notifications

- RF-15: Cuando se completa o falla una transferencia, se genera una
  notificación (para efectos del proyecto: **log estructurado**, no email/SMS
  real — ver fuera de alcance).

### 1.5 API Gateway

- RF-16: El cliente solo interactúa con el Gateway; nunca llama
  directamente a un microservicio interno.
- RF-17: El Gateway centraliza la validación de JWT para las rutas que lo
  requieren.

## 2. Requerimientos no funcionales

- RNF-01: **Consistencia entre servicios** vía patrón Saga (no
  transacciones distribuidas ACID/2PC).
- RNF-02: **Idempotencia** en comandos síncronos (`reference`) y en
  consumidores de eventos (tabla de eventos procesados).
- RNF-03: **Database-per-service**: cada servicio con su propio Postgres,
  sin acceso cruzado a esquemas ajenos.
- RNF-04: **Observabilidad mínima**: logging estructurado (JSON) +
  correlation ID propagado entre Gateway → servicios → eventos.
- RNF-05: **Testing**: unit tests por servicio + al menos un test de
  integración/e2e del flujo completo de transferencia.
- RNF-06: **Contenerización**: todo el sistema debe poder levantarse con
  `docker-compose up` en un entorno local limpio.
- RNF-07: **Resiliencia básica**: timeout + reintentos acotados + circuit
  breaker en la llamada síncrona Transactions → Accounts (anotado en
  Etapa 2, se implementa en Etapa 6/11).
- RNF-08: El sistema debe poder ejecutarse completo en una máquina de
  desarrollo estándar (sin depender de servicios cloud pagos).

## 3. Explícitamente fuera de alcance (por ahora)

Esto existe para evitar "scope creep" mientras aprendemos. Se puede revisar
más adelante si el proyecto crece, pero no se implementa salvo decisión
explícita:

- ❌ Múltiples tipos de cuenta (corriente, sobregiro, cuentas conjuntas).
- ❌ Múltiples monedas por cuenta / conversión de divisas (FX).
- ❌ Envío real de emails/SMS push (Notifications solo loguea).
- ❌ KYC, verificación de identidad, cumplimiento regulatorio real.
- ❌ Multi-tenancy (el sistema es de un solo "banco").
- ❌ Roles/permisos granulares más allá de "usuario autenticado" (no hay
  admin, soporte, etc. en la v1).
- ❌ Alta disponibilidad real / escalado horizontal en producción (se toca
  el concepto en Etapa 14 de forma simple, no se monta infraestructura
  productiva real).
- ❌ Rate limiting avanzado o WAF (se implementa un rate limiting básico en
  el Gateway como ejercicio, nada de nivel productivo).
- ❌ UI/frontend (el proyecto es 100% backend; se puede probar con
  Postman/curl/Insomnia).
- ❌ Auditoría legal de transacciones, retención de datos regulatoria.
- ❌ Recuperación de password, 2FA, OAuth con proveedores externos.

## 4. Criterio de "hecho" para el proyecto completo

El sistema se considera funcionalmente completo cuando, desde un
`docker-compose up` limpio, un cliente puede vía el Gateway: registrarse,
loguearse, abrir una cuenta, depositar, y transferir a otra cuenta,
recibiendo la notificación (log) correspondiente — con tests automatizados
cubriendo ese flujo y sin transacciones distribuidas ACID.

---

**Siguiente paso (Etapa 3):** setup del monorepo y tooling, ya con el
alcance cerrado.
