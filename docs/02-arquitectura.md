# Etapa 2 — Diseño de arquitectura de microservicios

## 1. Decisión de comunicación síncrona (cierre de la pregunta abierta de Etapa 1)

**Decisión**: Debit/Credit entre `Transactions` y `Accounts` se resuelven vía
**HTTP interno** (REST simple, servicio a servicio). RabbitMQ queda reservado
en exclusiva para **eventos de dominio asíncronos** (Etapa 7).

Razón: simplicidad para razonar sobre el flujo mientras aprendemos Sagas
(Etapa 6); no mezclamos "comando sincrónico que necesita respuesta inmediata"
con el broker que usaremos para "avisos" fire-and-forget. Migrar a
RPC-sobre-RabbitMQ queda como ejercicio opcional más adelante.

> **Nota "nivel senior" a vigilar**: un HTTP call síncrono entre servicios es
> un punto de fallo en cascada si el callee está lento/caído. En Etapa 6/11
> vamos a introducir **timeout explícito + reintentos acotados + circuit
> breaker** (ej. librería `cockatiel` o pattern manual) en el cliente HTTP de
> Transactions → Accounts, en vez de dejar el timeout por defecto del cliente
> HTTP. Lo dejamos anotado aquí para no olvidarlo, pero no lo implementamos
> todavía (todavía no existe el código).

## 2. Diagrama de contenedores (C4 — nivel 2)

```mermaid
graph TB
    Client["Cliente (web/mobile)"]

    subgraph Edge["Edge"]
        GW["API Gateway (NestJS BFF)<br/>REST + auth centralizada"]
    end

    subgraph Services["Servicios de negocio"]
        AUTH["Auth Service<br/>NestJS"]
        ACC["Accounts Service<br/>NestJS"]
        TX["Transactions Service<br/>NestJS"]
        NOT["Notifications Service<br/>NestJS"]
    end

    subgraph Data["Persistencia (database-per-service)"]
        AUTH_DB[("Postgres · auth")]
        ACC_DB[("Postgres · accounts")]
        TX_DB[("Postgres · transactions")]
    end

    MQ[["RabbitMQ<br/>(eventos de dominio)"]]

    Client -->|REST + JWT| GW
    GW -->|REST| AUTH
    GW -->|REST| ACC
    GW -->|REST| TX

    TX -->|HTTP interno: Debit/Credit| ACC

    AUTH --> AUTH_DB
    ACC --> ACC_DB
    TX --> TX_DB

    AUTH -.->|publish: UserRegistered| MQ
    ACC -.->|publish: AccountOpened, MoneyDeposited, MoneyWithdrawn| MQ
    TX -.->|publish: TransferCompleted, TransferFailed| MQ
    MQ -.->|consume| NOT
```

Notas:

- `Notifications` no tiene base de datos propia por ahora (consumidor puro,
  ver Etapa 1 §4). Si más adelante queremos historial de notificaciones,
  se añade su propio Postgres — nunca comparte el de otro servicio.
- El Gateway **no** llama directamente a `Notifications`: es un consumidor
  de eventos, no expone API al cliente.

## 3. Contratos entre servicios

### 3.1 Comandos síncronos (HTTP interno, Transactions → Accounts)

```ts
// POST /internal/accounts/:accountId/debit
interface DebitCommand {
  amount: number; // entero, en centavos, nunca float
  currency: string; // ISO 4217, ej. "USD"
  reference: string; // id de la transacción que origina el movimiento (idempotencia)
}

// POST /internal/accounts/:accountId/credit
interface CreditCommand {
  amount: number;
  currency: string;
  reference: string;
}

// Respuesta común (200 OK)
interface AccountMutationResult {
  accountId: string;
  balanceAfter: number;
}

// Error (409 Conflict, ej. fondos insuficientes)
interface AccountMutationError {
  code: 'INSUFFICIENT_FUNDS' | 'ACCOUNT_NOT_FOUND' | 'ACCOUNT_INACTIVE' | 'CURRENCY_MISMATCH' | 'IDEMPOTENCY_KEY_REUSED';
  message: string;
}
```

Los tipos reales viven en `libs/shared-contracts` y los comparten Accounts y Transactions.
Todas las rutas internas exigen el header `x-internal-api-key`. Además de débito y crédito,
Accounts expone `GET /internal/accounts/:accountId` (dueño, moneda, estado) para que Transactions
valide propiedad y moneda antes de iniciar una saga. Los montos son enteros en unidad mínima
y el tope por movimiento es `MAX_MOVEMENT_AMOUNT` (el saldo es `Int` de Postgres).

`reference` es clave: es el `transactionId` generado por `Transactions`, y
`Accounts` lo debe usar como clave de idempotencia (no aplicar dos veces el
mismo débito/crédito si la llamada se reintenta). Esto se implementa en la
Etapa 5, pero el contrato lo definimos ya para que ambos servicios lo
respeten desde el día uno.

### 3.2 Eventos de dominio (asíncronos, vía RabbitMQ — Etapa 7)

Formato base (todo evento lo cumple, tipo "envelope"):

```ts
interface DomainEvent<N extends EventName = EventName> {
  eventId: string; // UUID, único por publicación (clave de idempotencia del consumidor)
  eventType: N; // ej. "AccountOpened"
  occurredAt: string; // ISO 8601
  payload: EventPayloadMap[N]; // el payload queda ligado al nombre del evento
}
```

Eventos (payloads en `libs/shared-contracts/src/events.ts`). Los marcados como publicados son los que
existen hoy; los demás están definidos en el contrato pero ningún servicio los emite todavía:

| Evento              | Publicador   | Payload clave                                                                | Estado      |
| ------------------- | ------------ | ---------------------------------------------------------------------------- | ----------- |
| `UserRegistered`    | Auth         | `{ userId, email }`                                                          | sin publicar |
| `AccountOpened`     | Accounts     | `{ accountId, ownerId, currency }`                                           | publicado   |
| `MoneyDeposited`    | Accounts     | `{ accountId, amount, balanceAfter }`                                        | sin publicar |
| `MoneyWithdrawn`    | Accounts     | `{ accountId, amount, balanceAfter }`                                        | sin publicar |
| `TransferCompleted` | Transactions | `{ transactionId, fromAccountId, toAccountId, amount, currency, initiatedBy }` | publicado   |
| `TransferFailed`    | Transactions | igual que `TransferCompleted` + `reason`                                     | publicado   |

### 3.3 Saga de transferencia (Transactions)

Orquestación dentro de Transactions (`src/saga`): `debit-source` (con compensación: crédito de
reembolso con `reference = <txId>:refund`) y luego `credit-destination`.

- **Rechazo firme (4xx de Accounts):** se compensan los pasos previos y la transacción queda `FAILED`.
- **Resultado desconocido (5xx, timeout, circuito abierto):** NO se compensa, porque reembolsar un
  débito que quizá nunca ocurrió crearía dinero. La transacción sigue `PENDING`.
- **Falla la compensación:** estado `COMPENSATION_FAILED`.
- `PENDING` y `COMPENSATION_FAILED` se **reanudan** cuando el cliente repite la petición con el mismo
  `Idempotency-Key`; es seguro porque cada paso es idempotente por `reference` en Accounts.
  Un job de reconciliación para transacciones atascadas queda fuera de alcance.

### 3.4 Mensajería (RabbitMQ)

- Cola única `notifications.events`, durable, con dead-letter queue `notifications.events.dlq`.
- El publicador (`libs/messaging`) nunca lanza: un broker caído se registra en el log y no rompe la
  operación ya completada. No hay outbox, así que si el proceso muere entre el commit y la publicación
  el evento se pierde (riesgo de _dual write_ aceptado en v1).
- El consumidor confirma (ack) al terminar; el primer fallo reencola, el segundo va a la DLQ.
- Idempotencia del consumidor por `eventId`; el almacén es en memoria (se pierde al reiniciar) detrás de
  la interfaz `ProcessedEventsStore`, lista para cambiarse por una tabla.

## 4. Estrategia de datos

- **Database-per-service** confirmado: un Postgres por servicio con
  esquema propio, sin joins cross-servicio ni tablas compartidas.
- Ningún servicio consulta la base de otro directamente. Toda lectura
  cross-contexto pasa por API (HTTP interno) o por proyección local
  construida a partir de eventos consumidos (ej. si `Transactions` quisiera
  cachear un saldo, lo haría escuchando `MoneyDeposited`/`MoneyWithdrawn`,
  nunca leyendo la tabla de `Accounts`).

## 5. Próximo paso (Etapa 3)

Setup del monorepo: gestor de paquetes (npm workspaces vs pnpm), estructura
de carpetas (`services/`, `gateway/`, `libs/`), linter/formatter compartido,
y `docker-compose` base con Postgres x3 + RabbitMQ (sin código de negocio
todavía, solo infraestructura arrancando).
