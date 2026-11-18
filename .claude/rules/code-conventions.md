---
paths:
  - "src/**/*.ts"
---

# Code conventions

These apply to new files and to the code you change. Do not rewrite other code to match. Old code here is no precedent: copy the examples below, not your neighbours.

- **Public API:** customers call the default export, `GleapAdmin.instance`. A new capability is a method on the `GleapAdmin` class, and it follows the existing contract:
  - one or two positional parameters, the second an options object;
  - `async`, returning the parsed response body or `null`/`false`;
  - it never throws: it catches, logs and returns `null` or `false`;
  - a JSDoc comment says what the method does, what it returns and what it never touches.

  Its parameter and result types are interfaces next to the class. The README documents the method in the same PR.
- **Size:** aim for files under 400 lines, and never write a new one over 700. Functions are limited to 80 lines, counted without blanks and comments. These are working values, not proven limits. Tests and data tables have none.
  - `src/index.ts` is already over the file limit and must not grow much. A new method stays a thin wrapper there; the request building and payload mapping for a new area go in a new `src/<area>.ts` module.
  - Split by responsibility; never squeeze code onto fewer lines.
- **Parameters:** at most 2 positional parameters; from 3 on, use one object: `fn({ a, b, c })`.
- **Files:**
  - Every module is `src/<name>.ts`, with a camelCase name that is unique in the repo.
  - No new `index.ts`, `types.ts`, `utils.ts` or `helpers.ts`, and no barrel files.
  - Tests go in `src/__tests__/`, the only folder the build leaves out.
- **Imports:**
  - Node built-ins come with the `node:` prefix.
  - Type-only imports use `import type`.
  - Add no runtime dependency. Requests go through `request` in `src/httpclient.ts`.
- **Code:**
  - `const` arrow functions and named exports. Classes only for the public `GleapAdmin` class and `Error` subclasses.
  - No `enum`, `namespace` or constructor parameter properties. A closed set of values is an `as const` array or object with its union type, as `recordType` is.
- **Node and syntax:** `tsconfig.json` targets ES2020 and `engines` promises Node 18, so use only what both have. `Array.prototype.at`, `Object.hasOwn`, `structuredClone` and `fetch` are out; `npm run typecheck` catches the syntax and library parts.
- **Requests:**
  - Validate every id before any request: a non-empty string, else a `TypeError` inside the method's `try`.
  - Encode each path segment with `encodeURIComponent`.
  - Send the token only as the `Api-Token` header.
  - Treat any status outside 2xx as a failure and 404 as "not found" where reading. Copy `getCompany`.
- **Errors:** no empty `catch`. A catch that deliberately falls back says why in one line.
- **Logging:**
  - A failure is logged once, in the public method that gives up: `console.error('[Gleap] Failed to <action>', error)`. Old methods use `console.log`; leave them, because customers' log pipelines may depend on it.
  - Never log the token, request options, headers or payloads.
- **Noise:**
  - No new `any`, `as` (except `as const` and narrowing a parsed response to its interface), `!` or `@ts-ignore`. `@ts-expect-error` only with a reason.
  - A comment says why, in English, in one or two lines, and only where the code cannot.
  - Comments carry no ticket or PR numbers, people's names, dates or decision histories: those belong in the PR.

## One job, one system

New code uses the first column. A new import of a package from the last column fails the quality check.

| Job | Use | Not in new code |
|---|---|---|
| Sending a request to the Gleap API | `request` in `src/httpclient.ts` (`post` only where the status does not matter) | `axios`, `node-fetch`, `got`, `undici`, `ky`, `superagent`, global `fetch` |
| Validating caller input | a type check before the request, as `pipelineEntryPath` does | `zod`, `joi`, `yup`, `ajv`: no runtime dependencies |
| The base URL | `apiUrl`, normalized by `normalizeApiUrl` | building hosts or protocols anywhere else |

## Examples to copy

These are the closest we have today, so copy only what each line names.

- A read with validation, encoding, status handling and the `null` contract: `getCompany` in `src/index.ts`. Not its `console.log`.
- Path building from caller ids with exactly-one-of validation: `pipelineEntryPath` in `src/index.ts`.
- A JSDoc that states what a method never touches: `deleteCompany` and `removePipelineEntry`.
- A test of what a method sends and returns: `src/__tests__/company.test.ts`.
