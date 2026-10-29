import fs from 'node:fs';
const source = fs.readFileSync(new URL('../server/prisma/schema.prisma', import.meta.url), 'utf8');
const expected = source
  .replace('provider = "sqlite"', 'provider = "postgresql"')
  .replace(
    'url      = env("DATABASE_URL")',
    'url      = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")',
  );
const target = new URL('../server/prisma-postgres/schema.prisma', import.meta.url);
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== expected) {
    console.error('PostgreSQL schema differs. Run npm run db:sync-schema.');
    process.exitCode = 1;
  } else console.log('SQLite/PostgreSQL models match.');
} else {
  fs.mkdirSync(new URL('../server/prisma-postgres/', import.meta.url), { recursive: true });
  fs.writeFileSync(target, expected);
  console.log('PostgreSQL schema synchronized; review and migrate schema changes separately.');
}
