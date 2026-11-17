import { Result } from '@mini-bank/http-client';

/**
 * Saga por ORQUESTACIÓN (docs/02-arquitectura.md §4): un coordinador central (este archivo) ejecuta los
 * pasos en orden y, si uno falla, deshace los ya completados con su acción compensatoria.
 * Sustituye a una transacción distribuida (2PC), imposible entre bases de datos separadas.
 */
export interface SagaStep<TContext, TError> {
  readonly name: string;
  execute(context: TContext): Promise<Result<unknown, TError>>;
  /** Deshace `execute`. Opcional: un paso sin efectos que revertir (o el último) no la necesita. */
  compensate?(context: TContext): Promise<Result<unknown, TError>>;
}

/**
 * Resultado de una saga, como unión discriminada por `status` (el `switch` del consumidor es exhaustivo).
 *  - FAILED:              un paso fue rechazado y todo lo anterior quedó deshecho. Dinero a salvo.
 *  - UNCERTAIN:           un paso no respondió (timeout / servicio caído): ignoramos si se aplicó. NO se
 *                         compensa, porque devolver dinero que quizá nunca salió lo duplicaría. Se reanuda.
 *  - COMPENSATION_FAILED: falló el deshacer; hay dinero a medio mover. También se reanuda.
 */
export type SagaOutcome<TError> =
  | { status: 'COMPLETED' }
  | { status: 'FAILED'; failedStep: string; error: TError }
  | { status: 'UNCERTAIN'; failedStep: string; error: TError }
  | { status: 'COMPENSATION_FAILED'; failedStep: string; error: TError; compensationError: TError };

export interface SagaOptions<TError> {
  /** `true` si el error es una respuesta firme (p. ej. 4xx); `false` si el resultado del paso es desconocido. */
  isDefinitive: (error: TError) => boolean;
}

/** Genérico en el contexto (datos compartidos por los pasos) y en el tipo de error. */
export class SagaOrchestrator<TContext, TError> {
  constructor(
    private readonly steps: ReadonlyArray<SagaStep<TContext, TError>>,
    private readonly options: SagaOptions<TError>,
  ) {}

  async run(context: TContext): Promise<SagaOutcome<TError>> {
    const completed: SagaStep<TContext, TError>[] = [];

    for (const step of this.steps) {
      const result = await step.execute(context);
      if (result.ok) {
        completed.push(step);
        continue;
      }

      const failure = { failedStep: step.name, error: result.error };
      if (!this.options.isDefinitive(result.error)) return { status: 'UNCERTAIN', ...failure };
      return this.rollback(completed, context, failure);
    }

    return { status: 'COMPLETED' };
  }

  private async rollback(
    completed: ReadonlyArray<SagaStep<TContext, TError>>,
    context: TContext,
    failure: { failedStep: string; error: TError },
  ): Promise<SagaOutcome<TError>> {
    // Orden inverso: se deshace primero lo último que se hizo.
    for (const step of [...completed].reverse()) {
      if (!step.compensate) continue;

      const result = await step.compensate(context);
      if (!result.ok) return { status: 'COMPENSATION_FAILED', ...failure, compensationError: result.error };
    }
    return { status: 'FAILED', ...failure };
  }
}
