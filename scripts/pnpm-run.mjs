import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localPnpm = resolve(root, '.tools/pnpm-bin/pnpm');
const args = process.argv.slice(2);

let command = 'pnpm';
let commandArgs = args;
let env = {
  ...process.env,
  XDG_CACHE_HOME: process.env.XDG_CACHE_HOME ?? resolve(root, '.cache'),
};

if (process.env.npm_execpath?.includes('pnpm')) {
  if (/\.[cm]?js$/.test(process.env.npm_execpath)) {
    command = process.execPath;
    commandArgs = [process.env.npm_execpath, ...args];
  } else {
    command = process.env.npm_execpath;
    commandArgs = args;
  }
} else if (existsSync(localPnpm)) {
  command = localPnpm;
  env = {
    ...env,
    PATH: `${resolve(root, '.tools/pnpm-bin')}:${env.PATH ?? ''}`,
  };
}

const child = spawn(command, commandArgs, {
  cwd: root,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));
