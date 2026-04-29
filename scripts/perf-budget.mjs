import { gzipSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'frontend/dist/assets');
const budgets = {
  initialEntryKb: 90,
  appLayoutKb: 20,
  realtimeKb: 18,
  emojiKb: 85,
};

if (!existsSync(distDir)) {
  console.error('frontend/dist/assets does not exist. Run the frontend build first.');
  process.exit(1);
}

function gzipKb(file) {
  return gzipSync(readFileSync(join(distDir, file))).length / 1024;
}

const jsFiles = readdirSync(distDir).filter((file) => file.endsWith('.js'));
const entry = jsFiles.find((file) => /^index-/.test(file));
const appLayout = jsFiles.find((file) => /^AppLayout-/.test(file));
const realtime = jsFiles.find((file) => /^realtime-/.test(file));
const emoji = jsFiles.find((file) => /^emoji-/.test(file));

const checks = [
  ['initial entry', entry, budgets.initialEntryKb],
  ['chat app route', appLayout, budgets.appLayoutKb],
  ['realtime chunk', realtime, budgets.realtimeKb],
  ['emoji chunk', emoji, budgets.emojiKb],
];

for (const [label, file, budget] of checks) {
  if (!file) {
    console.error(`Missing ${label} bundle.`);
    process.exit(1);
  }
  const size = gzipKb(file);
  if (size > budget) {
    console.error(`${label} bundle is ${size.toFixed(2)} kB gzip, over ${budget} kB budget.`);
    process.exit(1);
  }
  console.log(`${label}: ${size.toFixed(2)} kB gzip / ${budget} kB budget`);
}
