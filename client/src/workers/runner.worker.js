import { runProgram } from './interpreter';

self.onmessage = (event) => {
  const { runId, program } = event.data;
  try {
    self.postMessage({ runId, trace: runProgram(program) });
  } catch (error) {
    self.postMessage({ runId, error: { message: error.message, line: error.line ?? null } });
  }
};
