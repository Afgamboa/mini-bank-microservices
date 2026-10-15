# @mini-bank/auth-shared

Shared JWT verification pieces (`JwtStrategy`, `JwtAuthGuard`, `@Auth()`
decorator) used by any service that needs to protect routes with the JWT
issued by `auth-service`, without querying `auth-service`'s own database.

Consumed as a workspace package (`"@mini-bank/auth-shared": "workspace:*"`)
by `accounts-service` and, later, `transactions-service`.
