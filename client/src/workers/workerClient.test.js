import { afterEach, describe, it, expect, vi } from 'vitest';
import { startProgram } from './workerClient';
class FakeWorker {
  static last;
  constructor() {
    FakeWorker.last = this;
    this.terminate = vi.fn();
  }
  postMessage(message) {
    this.message = message;
  }
}
afterEach(() => vi.useRealTimers());
describe('worker lifecycle', () => {
  it('terminates on success and ignores stale messages', () => {
    const onComplete = vi.fn(),
      onError = vi.fn();
    startProgram({ source: 'let x=1;' }, { onComplete, onError }, FakeWorker);
    const w = FakeWorker.last;
    w.onmessage({ data: { runId: 'stale', trace: {} } });
    expect(onComplete).not.toHaveBeenCalled();
    w.onmessage({ data: { runId: w.message.runId, trace: { steps: [] } } });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(w.terminate).toHaveBeenCalledTimes(1);
    w.onmessage({ data: { runId: w.message.runId, trace: {} } });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
  it('kills a timed-out worker and cancellation prevents callbacks', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn(),
      onError = vi.fn();
    startProgram({}, { onComplete, onError }, FakeWorker);
    vi.advanceTimersByTime(2000);
    expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('timed out'));
    onError.mockClear();
    const cancel = startProgram({}, { onComplete, onError }, FakeWorker);
    cancel();
    vi.advanceTimersByTime(3000);
    expect(onError).not.toHaveBeenCalled();
  });
});
