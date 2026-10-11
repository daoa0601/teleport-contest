# NetHack TypeScript port

This fork ports NetHack 5.0 from the pinned C and Lua sources in
`nethack-c/upstream/`. The port is incomplete. Game rules, not recorded
sessions, define the implementation.

## Start here

- [AGENTS.md](AGENTS.md): working rules and test-process safety.
- [Porting handoff](docs/porting-status.md): current work and known blockers.
- `src/js/`: authored runtime. `src/test/`: authored behavior tests.
- `src/scripts/` and `src/tools/`: authored tools.
- Root JavaScript paths are compiler output retained for the unchanged grader.

Read the detailed references below only when the task needs them.

## Run locally

Development uses strict TypeScript and project-local Vite+ tools. Use Node.js
22.18+ on 22.x, 24.11+ on 24.x, or 26+. The unchanged judge loads the emitted
JavaScript with Node.js 22 or later, without installing dependencies.

All owned runtime, test, and tool modules are TypeScript. Strict checks run
before emission, and failed checks stop development, tests, and builds.
See the handoff for behavior validation and the remaining porting gaps.

```bash
npm ci
npm run dev
# Open http://127.0.0.1:5173/
```

`npm run play` also starts the dev server. Code edits reload the page; they do
not hot-swap a running game's state. No global `vp` installation is needed.
After `npm run compile` succeeds, a static server can serve the emitted files:
`python3 -m http.server 8000`.

### Fast checks

```bash
# Check all authored runtime, tests, tools, and TypeScript configs
npm run check
npm run typecheck
npm run typecheck:watch

# Run or watch a focused behavior test
npm run compile && node --test test/enchant_weapon.test.js
npm run test:watch -- test/enchant_weapon.test.js

# Full behavior suite, once a coherent batch is ready
npm test
```

Behavior tests still use `node:test`, not Vitest. Use `npm test`, not `vp test`.
The test watcher requires explicit files. Stop it with Ctrl-C before starting
another verifier. Before a full suite or corpus, follow the process checks in
[AGENTS.md](AGENTS.md).

Every owned module is included in `tsconfig.json`. Strict checking also covers
unchecked array access, optional property presence, return paths, and unknown
exceptions. Type-safety lint rejects `any`, compiler suppression comments,
unsafe values and narrowing casts, non-null and definite-assignment assertions,
unhandled promises, and non-exhaustive union switches. ESLint suppression
comments are ignored; native Oxlint suppression comments are rejected before
lint runs. Nested lint
configs and ignore files cannot exempt owned sources. Source directories accept
only `.ts` and `.mts` code; other JavaScript and TypeScript extensions fail the
guard instead of bypassing checks. Every game-state field needs an explicit
persistence classification; adding an unclassified field fails compilation.
Test, build, development, and scoring commands require compilation to succeed first.

Keep `.js` and `.mjs` import specifiers in TypeScript sources: NodeNext resolves
them to `.ts` and `.mts` while checking, and emitted imports retain the grader's
paths. Do not edit root JavaScript output. `npm run compile` emits only after
checking every source file. The watcher stops its previous process when source
changes and restarts only after the current revision compiles successfully.

### Browser build and smoke test

```bash
npm run build
npm run preview
# Open http://127.0.0.1:4173/

# Install the test browser once, then check dev and built pages
npm exec -- playwright install chromium
npm run test:browser
```

The smoke test starts its own servers on ports 4173 and 4174. Stop a manual
preview server first. It starts a game and checks keyboard input in Chromium.
`dist/` is a browser preview artifact, not the judge entry point. The pinned
Vite/Vitest overrides must stay aligned with the `vite-plus` version when
updating dependencies.

## Contest contract

`js/jsmain.js` exports `runSegment(input, prevGame = null)`. The judge reads
its screens, random-call log, and cursors. Runtime code cannot use native
addons, WASM, filesystem access, network access, or threads. Persistent
state goes through the frozen storage interface.

Do not edit `js/isaac64.js`, `js/terminal.js`, or `js/storage.js`.
The judge supplies the canonical versions. Public sessions in `sessions/`
are evaluation inputs, not runtime data or mechanic specifications.

`npm run score` runs the public scorer. It can overwrite frozen copies in
`js/`; follow the restore instructions in `AGENTS.md` before committing.
Set the participant category with `bash frozen/set-category.sh agentic`
(or `transpiled` or `other`, as appropriate). Submissions are public forks;
pushing triggers public scoring, and the judge re-scores forks about every
two hours.

## References

- [API and scoring contract](docs/API.md)
- [Contest phases, diff-based maintainability scoring, and eligibility](docs/PHASES.md)
- [C recorder build and environment variables](nethack-c/README.md)
- [Recorder patches](nethack-c/patches/README.md)
- [Session viewer](tools/session-viewer/README.md)
- [Original contest guide](https://github.com/davidbau/teleport-contest#readme)
- [Leaderboard](https://mazesofmenace.ai/)
