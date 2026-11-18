# gleap-admin (GleapAdmin-NodeJS)

The public npm package [`gleap-admin`](https://www.npmjs.com/package/gleap-admin): Gleap's server-side Node.js SDK. Customers install it in their own backends and call the Gleap Admin API with their project's secret API token, to identify contacts, track events, and create, read and delete companies and CRM pipeline entries. Gleap's own Server (`../Server`, from a worktree `../../Server`) uses it the same way to track Gleap in Gleap. It stores nothing and runs no server of its own. The repository is public: everything you commit is public.

TypeScript 5, compiled by `tsc` to CommonJS (ES2020) in `dist/`. No runtime dependencies: Node's own `http` and `https` only. `engines.node` is `>=18`. Development and CI run the Node in `.nvmrc`; npm with `package-lock.json`.

Layout:
- `src/index.ts`: the `GleapAdmin` class, its public types and the default export `GleapAdmin.instance`.
- `src/httpclient.ts`: `request` and `post`, the only way the SDK sends anything.
- `src/__tests__/`: the tests and their support code. `tsconfig.json` leaves this folder out of the build.
- `examples/`: billing webhooks for the README. Not built and not tested.
- `demo.js`: a manual smoke test of the built package that sends real requests.

The endpoints belong to the Server repo: `src/api/admin/controller.ts` and `src/api/admin/pipelines.controller.ts`, mounted at `/admin` in `src/api/index.ts`.

## Commands

```bash
npm ci                                      # install; also links the pre-push hook
npm run typecheck                           # tsc over src and the tests, nothing emitted
npm run lint                                # ESLint over src
npm test                                    # every test, on the TypeScript sources (no build), a few seconds
npm test -- src/__tests__/company.test.ts   # one file; --test-name-pattern="text" for one case
npm run test:coverage                       # every test with coverage of src/ and its floors (CI)
npm run build                               # typecheck, lint and tests, then tsc to dist/: what npm publishes
npm pack --dry-run                          # the files a release would publish
npm run quality                             # the quality check on what this branch adds to origin/main
npm run test:quality                        # the quality check's own tests, about a minute
```

Done means:
- `npm run typecheck`, `npm run lint` and `npm test` pass;
- the quality check reports nothing new (the edit and stop hooks run it);
- CI is green.

`.github/workflows/ci.yml` runs the typecheck, lint, the tests with coverage, the build and the pack check. It also runs the tests on every supported LTS line and the quality check's own tests. `.github/workflows/quality.yml` runs the quality check. Say which commands you ran and what they printed.

New worktree: `npm ci`; nothing else is needed. Tests never reach the network: the Gleap API is faked at Node's http boundary (`src/__tests__/support/fakeGleapApi.ts`), and `scripts/test/offline.mjs` refuses every connection that would leave this machine.

`git push` runs the quality check on your branch (`.githooks/pre-push`). Fix what it reports and push again; never `--no-verify`.

## Production

This repository has no server. Production is every backend that has installed `gleap-admin`: the code runs inside customers' processes with their secret tokens, and inside Gleap's own Server (`gleap-admin` in `../Server/package.json`).

- **A release is `npm publish`.** Today a maintainer publishes it by hand. `prepublishOnly` runs `npm run build`: typecheck, lint, tests, then `tsc`. A published version cannot be taken back: `npm unpublish` works only for 72 hours and breaks everyone who installed it. A `1.x` release reaches every `^1` range on the next install. Never run `npm publish`, `npm version`, `npm dist-tag`, `npm deprecate` or `npm unpublish`, and never push a tag or create a GitHub release. Prepare the change, and a maintainer releases it.
- **The default endpoint is the live Gleap API** (`https://api.gleap.io`). With a real token every call is real:
  - `identify` writes a contact;
  - `deleteCompany` deletes a customer's company;
  - `addPipelineEntry` and `updatePipelineEntry` run the pipeline's automations.

  Never call the SDK with a real token, and never run `demo.js` or `examples/`. A token never goes into code, tests, examples or logs; tests use `test-token`. If you see a token that looks real, stop and report it.
- **The public API is a semver contract.** It covers:
  - the default export and every public method's name, parameters and return value (`null` or `false` on failure);
  - the rule that no method throws;
  - the `initialize` options and the log prefix;
  - `main`, `typings`, `files` and `engines` in `package.json`.

  Removing, renaming or changing any of these is a major version, and that is a product decision.
- **No runtime dependencies.** Each one would be installed into every customer backend and Gleap's Server. `devDependencies` are for tooling only.
- **Server contract.** What the SDK sends is defined by the Server routes named above. Check the route, payload and status codes there before you change a request. The Server must keep accepting what every published SDK version sends.
- **The build must stay what it is.** `dist/` is what customers run. A change to `tsconfig.json` (`target`, `module`, `lib`, `declaration`, `exclude`) changes every customer's code; prove the build output before and after.

## Code

New files and the code you change follow `.claude/rules/code-conventions.md`, and tests follow `.claude/rules/testing.md`. Read both before your first edit: old code here is no precedent. `/review` reviews a branch against them.

## Security

- **The secret API token** gives full read and write access to one Gleap project. It travels only in the `Api-Token` header. It never goes into a path, a body, a log line, an error message, a test or an example; `src/__tests__/apiToken.test.ts` checks this for every method.
- **Plain HTTP:** `apiUrl` allows `http:` so a customer can reach Gleap inside their own network. With `http:` the token travels in cleartext. Do not widen this: no redirects, no proxy support and no other hosts without asking.
- **Caller ids end up in URL paths.** Validate each id as a non-empty string before any request. Encode each path segment with `encodeURIComponent` on its own; `pipelineEntryPath` in `src/index.ts` is the pattern.
- **Logs** are `console.log` or `console.error` with the `[Gleap]` prefix, an action and the error. They never contain the token, request options or headers (they carry the token), or payload data (it holds customers' personal data).
- **No method throws into the customer's process.** It catches the error, logs it and returns `null` or `false`.

## Traps

- `GleapAdmin` is a singleton (`GleapAdmin.instance`). The token, `apiUrl`, the event buffer and the interval are shared by the whole process, and by all tests in one test file. `initialize` calls `stop` first. Tests call `GleapAdmin.stop()` in `after`.
- `initialize` starts a 2.5-second `setInterval` that is not `unref`'d, so a process that initializes the SDK stays alive until `stop()`.
- `trackEvent` only buffers. `sendEvents` empties the buffer before it sends, so a failed send drops those events. Before `initialize`, `trackEvent` still buffers and nothing sends.
- `identify` and `sendEvents` use `post`, which ignores the status code: `identify` returns `true` even when the API answers 401 or 500. Changing that changes customers' results: stop and ask.
- `request` has no timeout, and `post`'s contract (it resolves with the body) is kept for existing callers.
- `tsconfig.json` excludes only `**/__tests__/**`, so a test file anywhere else in `src/` would be compiled into `dist/` and published.
- `prebuild` runs the tests, so `npm run build` runs them too.
- Prettier takes tabs from `.editorconfig`. `src/index.ts` and the tests follow it, but `src/httpclient.ts` does not, and CI does not check formatting. Format a file you write with `npx prettier --write <file>`. Never run `npm run format`: it rewrites all of `src/`.
- `engines` still says `>=18`, but Node 18 and 20 are end-of-life and CI tests 22, 24 and 26. Raising `engines` is a breaking change: stop and ask.

## Customer requests

A ticket is one customer's view, and a bug report is too. Before changing anything for it:

- **A feature or a change:** decide whether it is right for the product. Would most customers want it, or does it belong behind an option every customer can use?
- **A bug report:** first check whether the code does something other than intended, from its tests, comments, the README and the history.
  - If it works as designed and the customer expected something else, it is not a bug: change nothing. Say so in your report, with what the customer can do instead.
  - Changing intended behaviour is a product decision: stop and ask.
- **Never special-case one customer in code:** no project ids, customer names, tokens or domains in conditions. If the only fix that works is specific to one customer, stop and ask.

## Stop and ask

Keep going while a step needs no input. Stop and ask before:

- anything that publishes or changes what npm serves, or bumping the version unless asked;
- adding a runtime dependency, or changing `engines`, `main`, `typings`, `files` or the build settings in `tsconfig.json`;
- changing the public API: renaming or removing a method or an option, or changing what a method returns, logs or throws;
- changing how the token travels, or which hosts and protocols `apiUrl` accepts;
- running anything against the real Gleap API;
- merging.
