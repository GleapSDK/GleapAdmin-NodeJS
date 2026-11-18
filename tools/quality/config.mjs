// The gleap-admin half of the quality check: limits, scope and names from .claude/rules/code-conventions.md.
import { basename } from 'node:path';

export const LIMITS = {
  // A new file over fileLines is a warning, over newFileLines an error. An existing file over fileLines may not grow.
  fileLines: 400,
  newFileLines: 700,
  functionLines: 80,
  positionalParams: 2,
  // Growth up to this in a file or function already over its limit is a note, not a failure.
  smallGrowthLines: 10,
  lineChars: 160,
  // This share of a new file found in what the change removed elsewhere makes it moved code.
  movedShare: 0.9,
  // This share of a file in literal tables makes it data, with no line limit.
  dataShare: 0.9,
  dataMinLines: 50,
};

// Tests and their support code live in src/__tests__/ and are excluded from the build; .claude/rules/testing.md
// covers them.
const OUT_OF_SCOPE = [/\.test\.[cm]?[jt]sx?$/, /\.d\.[cm]?ts$/, /\.generated\.[cm]?[jt]sx?$/, /(^|\/)__tests__\//];
const FIXTURE = [/(^|\/)fixtures\//, /\.fixtures?\.[cm]?[jt]sx?$/];

const NAME_PART = /^[a-z][A-Za-z0-9]*$/;

const fileNameProblem = ({ path }) => {
  const wanted = 'a file is <name>.ts, the name camelCase';
  if (!path.endsWith('.ts')) return wanted;
  const parts = basename(path, '.ts').split('.');
  return parts.length === 1 && NAME_PART.test(parts[0]) ? null : wanted;
};

const folderNameProblem = (folder) =>
  NAME_PART.test(basename(folder)) ? null : 'a new folder is lowercase, or camelCase when one word is not enough';

// Tests are named by topic in src/__tests__/, not after the module they cover, so no file name says whether a module
// has one. The testing rule, the stop hook and /review ask for them instead.
const testCandidates = () => null;

const URL_LIKE = /(^|\.)(location|url|uri|base|parsed|link|\w*(Url|URL|Uri|Location))$|^new URL\(/;
const URL_PROPERTIES = new Set(['origin', 'protocol', 'hostname', 'host', 'pathname']);

// One job, one system: the losing side of the table in .claude/rules/code-conventions.md.
const ONE_SYSTEM_BANS = [
  {
    rule: 'http-client-import',
    module: /^(axios|node-fetch|got|superagent|undici|ky|cross-fetch|isomorphic-fetch)(\/|$)/,
    fix: 'Send requests through request() in src/httpclient.ts: the package has no runtime dependencies.',
  },
];

export const config = {
  limits: LIMITS,
  isInScope: (path) => /^src\/.*\.[cm]?[jt]sx?$/.test(path) && !OUT_OF_SCOPE.some((pattern) => pattern.test(path)),
  // Fixtures have no line limit and no name or test rule. Every other rule still applies to them.
  isFixture: (path) => FIXTURE.some((pattern) => pattern.test(path)),
  registryFiles: new Set(),
  isModelFile: () => false,
  isParamsExemptFile: () => false,
  genericFileNames: new Set(['index', 'types', 'utils', 'helpers', 'controller', 'model', 'common', 'misc']),
  defaultExports: { isExemptFile: (path) => path === 'src/index.ts' },
  fixes: {
    'default-export': 'Use a named export. Only src/index.ts has a default export: the GleapAdmin instance customers import.',
    'console-log':
      'Remove it. A failure the customer must see is console.error with the [Gleap] prefix, and never the API token or the request headers.',
    ...Object.fromEntries(ONE_SYSTEM_BANS.map(({ rule, fix }) => [rule, fix])),
  },
  extraCounters: ONE_SYSTEM_BANS.map(({ rule }) => rule),
  bannedImports: ONE_SYSTEM_BANS,
  // These fire too often on code that cannot avoid them: an `as` narrows the parsed response body, `any` types the
  // dynamically shaped payloads, and most string comparisons compare a value the Gleap API owns. long-line warns only
  // until the check is required. Comment stamps only warn while old comments still carry them for new ones to copy.
  warningRules: new Set(['string-compare', 'type-assertion', 'any', 'long-line', 'needs-test', 'comment-attribution', 'comment-date']),
  // Until the check is required, growth of old code warns too. A new file over newFileLines still fails.
  legacySizeGrowthWarns: true,
  stringExemptions: {
    // `typeof` and the empty string are exempt in the core. Everything here needs a URL receiver.
    isExempt: ({ name, receiver }) => URL_PROPERTIES.has(name) && URL_LIKE.test(receiver),
  },
  fileNameProblem,
  folderNameProblem,
  testCandidates,
};
