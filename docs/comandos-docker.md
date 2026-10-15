# Comandos Docker — referencia rápida

> Este archivo agrupa comandos por sesión/herramienta. Cada `##` es una
> sesión distinta — no asumas que los comandos de una sección dependen del
> directorio de trabajo de la anterior (se indica el `cwd` cuando aplica).

## Sesión: Docker Compose (infraestructura — Postgres x3 + RabbitMQ)

> cwd: raíz del repo (`mini-bank-microservices/`)

Comandos usados para levantar y validar la infraestructura local definida
en [`docker-compose.yml`](../docker-compose.yml).

### Setup inicial

```powershell
Copy-Item .env.example .env
```
Crea tu archivo `.env` local a partir de la plantilla (credenciales de
Postgres y RabbitMQ). Ábrelo y ajusta passwords si quieres.

### Validación y ciclo de vida

```powershell
docker compose config
```
Parsea `docker-compose.yml` + `.env` y muestra la configuración resuelta
(sin levantar nada). Si hay un error de sintaxis o variable faltante, lo
verás aquí.

```powershell
docker compose up -d
```
Descarga las imágenes (`postgres:16-alpine`,
`rabbitmq:3.13-management-alpine`) si no las tienes, y arranca `auth-db`,
`accounts-db`, `transactions-db` y `rabbitmq` en background.

```powershell
docker compose ps
```
Muestra si los 4 servicios están `running` (healthy) o si alguno falló al
iniciar.

```powershell
docker compose logs -f
```
Sigue los logs de todos los contenedores en tiempo real (Ctrl+C para
salir).

```powershell
docker compose down
```
Detiene y elimina los contenedores (los volúmenes con los datos de
Postgres/RabbitMQ se mantienen, ya que están declarados como `volumes:`
nombrados).

### Verificación visual

Abre `http://localhost:15672` en el navegador para la consola de
administración de RabbitMQ (usuario/password = los definidos en `.env`,
por defecto `guest`/`guest`).

## Sesión: pnpm — instalación de dependencias (monorepo)

> cwd: raíz del repo o `services/auth-service` según se indique

```powershell
pnpm install
```
Instala las dependencias declaradas en `package.json` para el workspace
completo (o solo para `auth-service` si corres el comando dentro de
`services/auth-service`).

```powershell
pnpm approve-builds
```
pnpm 10+ bloquea por defecto los scripts `postinstall` de dependencias de
terceros (medida de seguridad contra supply-chain attacks). Este comando
abre una lista interactiva — marca con **espacio** cada paquete que
necesita compilar/generar algo al instalar (ej. `bcrypt`, `@prisma/client`,
`prisma`, `@nestjs/core`) y confirma con Enter. Queda registrado en
`pnpm-workspace.yaml` bajo `allowBuilds`.

## Sesión: Prisma — schema y migraciones (auth-service)

> cwd: `services/auth-service`

```powershell
Copy-Item .env.example .env
```
Crea el `.env` propio de `auth-service` (`DATABASE_URL` hacia `auth-db`,
`JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`).

```powershell
pnpm prisma:generate
```
Lee `prisma/schema.prisma` y genera el cliente TypeScript de Prisma
(`@prisma/client`) con los tipos del modelo `User`.

```powershell
pnpm prisma:migrate
```
Crea y aplica la primera migración (pide un nombre, ej. `init`): genera
`prisma/migrations/<timestamp>_init/migration.sql` con el `CREATE TABLE`
de `User` y lo ejecuta contra la base `auth`.

```powershell
pnpm exec prisma studio
```
Abre una UI en `http://localhost:5555` para inspeccionar/editar filas de
la base visualmente. Ctrl+C en la terminal para cerrarla.

