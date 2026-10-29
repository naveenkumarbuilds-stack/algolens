import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const postgres = process.env.TEST_DATABASE_URL;
if (postgres) {
  const target = new URL(postgres);
  if (
    process.env.CI !== 'true' ||
    !['localhost', '127.0.0.1'].includes(target.hostname) ||
    target.pathname !== '/algolens_test' ||
    !['postgresql:', 'postgres:'].includes(target.protocol)
  )
    throw new Error(
      'PostgreSQL tests require CI=true and a localhost database named algolens_test. Never use a production database.',
    );
}
const directory = mkdtempSync(path.join(tmpdir(), 'algolens-test-'));
writeFileSync(path.join(directory, 'test.db'), '');
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: postgres || `file:${path.join(directory, 'test.db').replaceAll('\\', '/')}`,
  ...(postgres && { DIRECT_URL: postgres }),
};
try {
  for (const [module, args] of [
    [
      'prisma/build/index.js',
      [
        'migrate',
        'deploy',
        '--schema',
        postgres ? 'prisma-postgres/schema.prisma' : 'prisma/schema.prisma',
      ],
    ],
    ['vitest/vitest.mjs', ['run']],
  ]) {
    const entry =
      module === 'vitest/vitest.mjs'
        ? path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
        : require.resolve(module);
    const result = spawnSync(process.execPath, [entry, ...args], {
      env,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status || 1;
      break;
    }
  }
} finally {
  // Delete only the temporary directory created by this invocation.
  if (path.dirname(directory) === tmpdir() && path.basename(directory).startsWith('algolens-test-'))
    rmSync(directory, { recursive: true, force: true });
}
