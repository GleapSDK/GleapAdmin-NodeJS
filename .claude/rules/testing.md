---
paths:
  - "src/**/*.ts"
  - "scripts/test/**"
---

# Testing

Tests come first and stay fixed while the code is written: an agent that may change a test will change it to get green.

- **New behaviour or a bug fix:** write the test first, from the requirement and not from the code. Use the `test-writer` subagent if you can start one. See it fail for the expected reason and commit it on its own, then write the code without touching it.
- **Refactor without a behaviour change:** tests stay unchanged. A move may change a test's import path, never its assertions. Nothing covers the code? Pin today's behaviour with a test first.
- **Never edit, skip or delete an existing test to make a change pass,** and never detect test inputs or hardcode answers. No `.skip`, `.only`, `todo`, retries or sleeps.
  - If a test looks wrong, stop and report `BLOCKED` with the reason.
  - A test changes only when the required behaviour changed; say so in the PR.
- **Never lower a coverage floor** in `scripts/test/run.mjs` to get a change through; raise it when coverage rises.

## How

Tests use `node:test` and `node:assert/strict`, in TypeScript under `src/__tests__/`. `npm test` runs them on the sources through tsx, with no build.

Nothing reaches the network:
- `fakeGleapApi()` (`src/__tests__/support/fakeGleapApi.ts`) replaces `http.request` and `https.request`, records every request the SDK sends and answers with `respondWith(status, body)`;
- `scripts/test/offline.mjs` refuses every connection that would leave this machine;
- a test that needs a real socket starts its own `node:http` server on `127.0.0.1`, port 0.

| What changed | Test |
|---|---|
| A public method: what it sends (method, path, `Api-Token`, body), what it returns, what it refuses before sending | `fakeGleapApi()`, asserting on `api.requests`: copy `src/__tests__/company.test.ts` |
| A new method | also add it to `everyCall` in `src/__tests__/apiToken.test.ts`, which checks that the token stays in the header and out of every log |
| `src/httpclient.ts` | a real local server: copy `src/__tests__/httpclient.test.ts` |
| The event buffer and the flush interval | `mock.timers` for `setInterval`: copy `src/__tests__/events.test.ts` |
| `apiUrl` handling | `src/__tests__/apiurl.test.ts` |
| README or comments only | nothing |

New tests read behaviour, not source text. They fake only what we do not own: the Gleap API, time and randomness. Never stub `src/httpclient.ts` or other modules of ours.

A test of a write asserts what was sent and what a refused or failed write returns (`null` or `false`).

`GleapAdmin` is a singleton: initialize it in `before`, and call `GleapAdmin.stop()` and `api.restore()` in `after`.

## What to run

- While you work: `npm test -- <file>`.
- Before you finish: `npm run typecheck`, `npm run lint` and `npm test`, all in a few seconds. The stop hook runs the typecheck and the tests.
- After a change to `tools/quality/`: `npm run test:quality`.

If no test reaches the code you changed, that is not a pass: say in your report what no test covered.
