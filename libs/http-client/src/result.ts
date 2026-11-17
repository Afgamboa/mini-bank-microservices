/**
 * Result<T, E>: error como valor en vez de excepción. Es una unión discriminada por `ok`,
 * así que TypeScript obliga a comprobarla antes de leer `value` o `error`:
 *
 *   const r = await client.get<Account>('/x');
 *   if (!r.ok) return r.error;   // aquí r.error está tipado
 *   r.value;                     // aquí r.value está tipado
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// `never` en el lado que no se usa permite asignar `ok(x)` a cualquier `Result<T, E>`.
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const fail = <E>(error: E): Result<never, E> => ({ ok: false, error });
