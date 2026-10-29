import fs from 'node:fs';
import crypto from 'node:crypto';

if (!fs.existsSync('.env')) fs.copyFileSync('.env.example', '.env');
const contents = fs.readFileSync('.env', 'utf8');
if (/^JWT_SECRET=[ \t]*\r?$/m.test(contents)) {
  fs.writeFileSync(
    '.env',
    contents.replace(
      /^JWT_SECRET=[ \t]*\r?$/m,
      `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`,
    ),
  );
}
// Pre-create SQLite files because the Windows engine may reject a missing file.
if (/^DATABASE_URL=file:\.\/dev\.db\r?$/m.test(contents) && !fs.existsSync('prisma/dev.db')) {
  fs.closeSync(fs.openSync('prisma/dev.db', 'ax'));
}
console.log('Local environment ready; existing configuration preserved.');
