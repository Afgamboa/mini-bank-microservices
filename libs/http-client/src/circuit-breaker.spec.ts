import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let time: number;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    time = 0;
    breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000, now: () => time });
  });

  it('opens after the failure threshold and rejects calls', () => {
    breaker.recordFailure();
    expect(breaker.canRequest()).toBe(true);

    breaker.recordFailure();
    expect(breaker.currentState).toBe('OPEN');
    expect(breaker.canRequest()).toBe(false);
  });

  it('lets one trial through after the reset timeout and closes on success', () => {
    breaker.recordFailure();
    breaker.recordFailure();

    time = 1000;
    expect(breaker.canRequest()).toBe(true);
    expect(breaker.currentState).toBe('HALF_OPEN');

    breaker.recordSuccess();
    expect(breaker.currentState).toBe('CLOSED');
  });

  it('reopens immediately when the trial call fails', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    time = 1000;
    breaker.canRequest();

    breaker.recordFailure();

    expect(breaker.currentState).toBe('OPEN');
    expect(breaker.canRequest()).toBe(false);
  });

  it('a success resets the consecutive failure count', () => {
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();

    expect(breaker.currentState).toBe('CLOSED');
  });
});
