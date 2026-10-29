export function startProgram(program, { onComplete, onError }, WorkerClass) {
  const runId = crypto.randomUUID();
  // Keep the real constructor static so Vite bundles the worker and its imports.
  const worker = WorkerClass
    ? new WorkerClass()
    : new Worker(new URL('./runner.worker.js', import.meta.url), { type: 'module' });
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    worker.terminate();
  };
  const timer = setTimeout(() => {
    cleanup();
    onError('Execution timed out after 2 seconds. Use a smaller input or check your loop.');
  }, 2000);
  worker.onmessage = ({ data }) => {
    if (finished || data.runId !== runId) return;
    cleanup();
    if (data.error) onError(data.error.message);
    else onComplete(data.trace);
  };
  worker.onerror = () => {
    if (finished) return;
    cleanup();
    onError('The execution worker could not start or stopped unexpectedly. Try again.');
  };
  try {
    worker.postMessage({ runId, program });
  } catch (error) {
    cleanup();
    throw error;
  }
  return cleanup;
}
