import { fail, ok, Result } from '@mini-bank/http-client';
import { SagaOrchestrator, SagaStep } from './saga-orchestrator';

interface TestError {
  status: number;
}

const options = { isDefinitive: (error: TestError) => error.status < 500 };

function makeStep(
  name: string,
  calls: string[],
  result: Result<unknown, TestError> = ok(undefined),
  withCompensation = true,
) {
  const step: SagaStep<null, TestError> = {
    name,
    execute: async () => {
      calls.push(`execute:${name}`);
      return result;
    },
  };
  if (withCompensation) {
    step.compensate = async () => {
      calls.push(`compensate:${name}`);
      return ok(undefined);
    };
  }
  return step;
}

describe('SagaOrchestrator', () => {
  it('runs every step in order and completes', async () => {
    const calls: string[] = [];
    const saga = new SagaOrchestrator([makeStep('a', calls), makeStep('b', calls)], options);

    await expect(saga.run(null)).resolves.toEqual({ status: 'COMPLETED' });
    expect(calls).toEqual(['execute:a', 'execute:b']);
  });

  it('compensates completed steps in reverse order when a step is rejected', async () => {
    const calls: string[] = [];
    const saga = new SagaOrchestrator(
      [makeStep('a', calls), makeStep('b', calls), makeStep('c', calls, fail({ status: 409 }))],
      options,
    );

    const outcome = await saga.run(null);

    expect(outcome).toEqual({ status: 'FAILED', failedStep: 'c', error: { status: 409 } });
    expect(calls).toEqual(['execute:a', 'execute:b', 'execute:c', 'compensate:b', 'compensate:a']);
  });

  it('does not compensate when the failing step outcome is unknown (5xx / timeout)', async () => {
    const calls: string[] = [];
    const saga = new SagaOrchestrator(
      [makeStep('a', calls), makeStep('b', calls, fail({ status: 504 }))],
      options,
    );

    const outcome = await saga.run(null);

    expect(outcome.status).toBe('UNCERTAIN');
    expect(calls).not.toContain('compensate:a');
  });

  it('reports COMPENSATION_FAILED when the undo itself fails', async () => {
    const calls: string[] = [];
    const brokenUndo = makeStep('a', calls);
    brokenUndo.compensate = async () => fail({ status: 503 });
    const saga = new SagaOrchestrator([brokenUndo, makeStep('b', calls, fail({ status: 409 }))], options);

    await expect(saga.run(null)).resolves.toMatchObject({
      status: 'COMPENSATION_FAILED',
      failedStep: 'b',
      compensationError: { status: 503 },
    });
  });

  it('skips steps that have nothing to undo', async () => {
    const calls: string[] = [];
    const saga = new SagaOrchestrator(
      [makeStep('a', calls, ok(undefined), false), makeStep('b', calls, fail({ status: 409 }))],
      options,
    );

    await expect(saga.run(null)).resolves.toMatchObject({ status: 'FAILED' });
    expect(calls).toEqual(['execute:a', 'execute:b']);
  });
});
