// Prints how the star rules score a real log, compared with the design's targets.
// Usage: npm run calibrate -- path/to/gymxp-backup.json (the file from Settings → Export)
// It only reads the file and prints to the terminal.
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run calibrate -- path/to/gymxp-backup.json');
  process.exit(1);
}
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { calibrationReport } = await server.ssrLoadModule('/src/dev/calibrate.ts');
  console.log(calibrationReport(JSON.parse(await readFile(file, 'utf8'))));
} finally {
  await server.close();
}
