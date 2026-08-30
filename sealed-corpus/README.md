# Sealed corpus gate

Status: infrastructure and unsealed driver qualification are implemented. The
first real 157-session gate was prepared, recorded, and aggregate-evaluated on
2026-08-30; its authorized failing sample has not yet been opened.

This directory contains the public corpus specification only. Actual gate
artifacts live under the ignored `.sealed-corpus/` root. The generator and
evaluator are separate commands so an implementation cannot quietly resample
inputs after seeing a result.

## Custody boundary

| Artifact | Disclosure | Purpose |
| --- | --- | --- |
| `manifest.json` | public | Aggregate strata, generation algorithm, source/tool revisions, disclosure policy, and keyed commitments |
| `private/plan.json` | sealed | Per-session seed, datetime, character identity, options, semantic driver, and recipe mapping |
| `private/raw/*.session.json` | sealed | C recorder answers and realized replay input |
| `recording-receipt.json` | public | Session count and corpus/receipt commitments only |
| `gate-result.json` | public after the gate | Overall and thresholded stratified RNG/screen metrics, never session rows |
| `private/release-authorization.json` | sealed | Key-ranked failing sample selected by the precommitted policy |
| `released-failure-sample/` | opened only after journal acknowledgement | At most the authorized failing sample |

The secret is never copied into the gate root. Session commitments and opaque
filenames use separate keyed hashes, so the public commitment list cannot be
joined to raw filenames. Private directories are mode `0700`; private files
are `0400` after they are frozen. Commitments detect later recipe, state,
receipt, or raw-trace changes.

## Corpus shape

`spec.v1.json` expands all 73 legal role/race/gender/alignment tuples and 84
additional scenario repetitions, for 157 committed sessions. The scenario
strata include every required command family, all four runmodes, option
families, ordinary and named dungeon contexts, special Lua layouts, and
save/restore chains.

Named branch and special-level cases do not assume fixed menu letters. Their
semantic recorder drivers open the live C dungeon menu, page until the named
destination is visible, extract its current selector, and record the realized
key sequence for later JavaScript evaluation. A public-constant-key
qualification command checks one disposable C run for each adaptive scenario
and the stateful save/restore recipe:

```sh
npm run qualify:sealed-drivers
```

This proves only that the six drivers reach their named C menu entries and the
save/restore recipe completes. It is not a JavaScript parity result and creates
no retained corpus.

## Scheduled gate procedure

Do not run these commands during ordinary implementation work. At an explicit
gate, first commit the intended source and verify that no Contest test,
recorder, scorer, or evaluator process is live. Create a binary 256-bit secret
outside the repository with permissions `0600`, then prepare exactly one new
gate root:

```sh
umask 077
openssl rand -out /secure/path/teleport-gate.key 32
node scripts/sealed-corpus-prepare.mjs \
  --gate-root .sealed-corpus/phase1-gate-001 \
  --gate-id phase1-gate-001 \
  --secret-file /secure/path/teleport-gate.key
```

Preparation refuses a dirty relevant tree or an existing gate root. It records
the committed C source, recorder source, generator, recorder binary, and
runtime-data revisions before writing the public manifest and private plan.

Record once, sequentially:

```sh
node scripts/sealed-corpus-record.mjs \
  --gate-root .sealed-corpus/phase1-gate-001 \
  --secret-file /secure/path/teleport-gate.key
```

The recorder suppresses identity-bearing diagnostics, owns and reaps its full
process group, checkpoints each completed trace, and resumes the same recipe
after interruption. It never launches two C sessions concurrently.

At the scheduled evaluation gate, run once:

```sh
node scripts/sealed-corpus-evaluate.mjs \
  --gate-root .sealed-corpus/phase1-gate-001 \
  --secret-file /secure/path/teleport-gate.key
```

Each session runs in a separate sequential worker with
`TELEPORT_BRIDGE_FREE=1` and fixtures disabled. The command freezes one
aggregate result; strata with fewer than three sessions suppress their
metrics. Interrupted evaluation resumes only unevaluated commitments, and a
second score is refused.

Before any trace is released, append the emitted line
`sealed-gate-result-sha256: <hash>` to the parity journal with the aggregate
result and gate decision. Only if that logged gate authorizes inspection may
the predeclared failing sample be opened:

```sh
node scripts/sealed-corpus-release-sample.mjs \
  --gate-root .sealed-corpus/phase1-gate-001
```

The release command cannot choose a different sample and cannot release
anything before the frozen-result hash appears in the journal.

If a command is interrupted, do not start a duplicate. Check the process
registry first. A stale `private/state/operation.lock` is intentionally not
removed automatically; remove it only after proving its owning process tree is
gone, then resume the same command and gate root.
