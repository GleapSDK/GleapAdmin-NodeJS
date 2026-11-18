// node --test tools/quality/check.test.mjs (npm run test:quality). The shared core's cases, then what only this
// repo's config decides.
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { config, LIMITS } from './config.mjs';
import { defineCoreCases } from './core.cases.mjs';
import { checkChange, checkChanges } from './rules.mjs';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TOOL_DIR, '../..');

defineCoreCases({
  describe,
  it,
  afterAll: after,
  config,
  LIMITS,
  checkChange,
  checkChanges,
  toolDir: TOOL_DIR,
  repoRoot: REPO_ROOT,
  toolRelative: 'tools/quality',
  pathFor: (name) => `src/${name}.ts`,
});

// Detection is tested with every rule at full strength. The core cases pin which rules only warn.
const strict = { ...config, warningRules: new Set(), legacySizeGrowthWarns: false };
const report = (change, pathExists = () => true) =>
  checkChange({ change: { isNewPath: change.before == null, newFolders: [], ...change }, config: strict, pathExists });
const rulesOf = (change, pathExists) => report(change, pathExists).violations.map(({ rule }) => rule);

const logic = 'export const run = (a: number) => a + 1;';

describe('scope', () => {
  for (const path of ['src/index.ts', 'src/httpclient.ts', 'src/pipelineEntries.ts']) {
    it(`checks ${path}`, () => assert.ok(config.isInScope(path), path));
  }
  for (const path of [
    'src/__tests__/company.test.ts',
    'src/__tests__/support/fakeGleapApi.ts',
    'scripts/test/run.mjs',
    'tools/quality/rules.mjs',
    'examples/stripe-webhook.js',
    'demo.js',
    'dist/index.js',
  ]) {
    it(`leaves out ${path}`, () => assert.ok(!config.isInScope(path), path));
  }
});

describe('file names', () => {
  for (const path of ['src/pipelineEntries.ts', 'src/companies.ts', 'src/events/batch.ts']) {
    it(`green: ${path}`, () => assert.deepEqual(rulesOf({ path, before: null, after: logic }), []));
  }
  for (const path of ['src/pipeline-entries.ts', 'src/pipeline_entries.ts', 'src/PipelineEntries.ts', 'src/companies.service.ts']) {
    it(`red: ${path}`, () => assert.ok(rulesOf({ path, before: null, after: logic }).includes('file-name')));
  }
  it('red: a new generic name', () => assert.ok(rulesOf({ path: 'src/helpers.ts', before: null, after: logic }).includes('generic-file-name')));
  it('red: a new folder that is not camelCase', () =>
    assert.ok(rulesOf({ path: 'src/rate-limits/budget.ts', before: null, after: logic, newFolders: ['src/rate-limits'] }).includes('folder-name')));
});

describe('default exports', () => {
  it('green: the GleapAdmin instance in src/index.ts', () =>
    assert.ok(!rulesOf({ path: 'src/index.ts', before: logic, after: `${logic}\nexport default run;` }).includes('default-export')));
  it('red: anywhere else', () =>
    assert.ok(rulesOf({ path: 'src/companies.ts', before: null, after: `${logic}\nexport default run;` }).includes('default-export')));
});

describe('needs-test', () => {
  it('asks for no test by file name: tests are named by topic in src/__tests__/', () =>
    assert.ok(!rulesOf({ path: 'src/companies.ts', before: null, after: logic }, () => false).includes('needs-test')));
});

describe('one job, one system', () => {
  for (const module of ['axios', 'node-fetch', 'got', 'undici', 'ky']) {
    it(`red: a new import of ${module}`, () =>
      assert.ok(rulesOf({ path: 'src/companies.ts', before: logic, after: `import x from '${module}';\n${logic}` }).includes('http-client-import')));
  }
  it('green: node:https and the own http client', () =>
    assert.deepEqual(
      rulesOf({ path: 'src/companies.ts', before: logic, after: `import https from 'node:https';\nimport { request } from './httpclient';\n${logic}` }),
      []
    ));
});
