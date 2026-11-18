// After every edit: the quality check and ESLint on that one file, so the agent sees problems at once. The typecheck
// and the tests wait for the stop hook.
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';

import { projectDirOf, runEditHook } from '../../tools/quality/hooks.mjs';

const projectDir = projectDirOf(import.meta.url);
const ESLINT = join(projectDir, 'node_modules/.bin/eslint');
const LINTED = /^src\/.*\.ts$/;

const lintProblems = (absolute) => {
  const path = relative(projectDir, absolute);
  if (!LINTED.test(path)) return '';
  const result = spawnSync(ESLINT, ['--quiet', path], { cwd: projectDir, encoding: 'utf8' });
  return result.status === 1 ? `ESLint found problems in ${path}:\n${result.stdout}${result.stderr}` : '';
};

await runEditHook({ projectDir, toolPath: join(projectDir, 'tools/quality/check.mjs'), extraCheck: lintProblems });
