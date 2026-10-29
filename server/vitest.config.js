import { defineConfig } from 'vitest/config';
// Integration suites share one disposable database; keep their cleanup sequential.
export default defineConfig({ test: { fileParallelism: false } });
