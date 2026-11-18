// Before a turn ends: the quality check, the typecheck and the tests, once per tree. Red means the turn is not done.
// All tests run: together they take a few seconds and reach nothing outside this machine.
import { join } from 'node:path';

import { projectDirOf, runStopGate } from '../../tools/quality/hooks.mjs';

const TYPECHECK_TIMEOUT_MS = 120_000;
const TESTS_TIMEOUT_MS = 120_000;

const projectDir = projectDirOf(import.meta.url);

await runStopGate({
  projectDir,
  toolPath: join(projectDir, 'tools/quality/check.mjs'),
  isCode: (file) => /^(src|scripts|tools)\/.*\.[cm]?[jt]s$/.test(file),
  stepsFor: () => [
    {
      name: 'npm run typecheck',
      command: 'npm',
      args: ['run', '--silent', 'typecheck', '--', '--pretty', 'false'],
      requires: 'node_modules/.bin/tsc',
      timeout: TYPECHECK_TIMEOUT_MS,
    },
    {
      name: 'npm test',
      command: process.execPath,
      args: ['scripts/test/run.mjs'],
      requires: 'node_modules/tsx',
      timeout: TESTS_TIMEOUT_MS,
    },
  ],
});
