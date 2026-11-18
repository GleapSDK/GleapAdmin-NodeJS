// Test entry point: node:test on the TypeScript sources through tsx, no build first. Usage:
//   npm test                                          every *.test.ts under src/
//   npm test -- src/__tests__/company.test.ts         one file, or a directory
//   npm test -- --test-name-pattern="text" <file>     one case (flags need the --flag=value form)
//   npm run test:coverage                             all of them, with line, branch and function coverage of src/
import { spawn } from 'node:child_process';
import { globSync, statSync } from 'node:fs';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const args = process.argv.slice(2);
const coverage = args.includes('--coverage');
const flags = args.filter((arg) => arg.startsWith('-') && arg !== '--coverage');
const paths = args.filter((arg) => !arg.startsWith('-'));

const kindOf = (path) => {
  const stats = statSync(path, { throwIfNoEntry: false });
  return stats?.isDirectory() ? 'directory' : stats ? 'file' : 'missing';
};
const missing = paths.filter((path) => kindOf(path) === 'missing');
if (missing.length) fail(`Not a file or directory: ${missing.join(', ')}. Flags take their value as --flag=value.`);

const roots = paths.length ? paths.filter((path) => kindOf(path) === 'directory') : ['src'];
const discovered = roots.flatMap((root) => globSync(`${root.replace(/\/$/, '')}/**/*.test.ts`));
const files = [...new Set([...paths.filter((path) => kindOf(path) === 'file'), ...discovered])].sort();
if (files.length === 0) fail(`No test files matched ${paths.join(' ') || 'src/'}`);

// Floors a little under what the suite reached when coverage started (98.1 / 92.8 / 90.9 %). Raise them as coverage
// rises; never lower one to get a change through.
const coverageFlags = [
  '--experimental-test-coverage',
  '--test-coverage-include=src/**',
  '--test-coverage-exclude=src/**/__tests__/**',
  '--test-coverage-lines=97',
  '--test-coverage-branches=91',
  '--test-coverage-functions=89',
];
const customReporter = flags.some((flag) => flag.startsWith('--test-reporter'));
const reporter = coverage || flags.includes('--watch') ? 'spec' : 'dot';

const nodeArgs = [
  '--enable-source-maps',
  '--import',
  'tsx',
  '--import',
  './scripts/test/offline.mjs',
  '--test',
  '--test-timeout=30000',
  ...(customReporter ? [] : [`--test-reporter=${reporter}`]),
  ...(coverage ? coverageFlags : []),
  ...flags,
  ...files,
];

const child = spawn(process.execPath, nodeArgs, { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', TZ: 'UTC' } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
