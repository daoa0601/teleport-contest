# Teleport contest working agreement

## Parity journal

Before changing parity-sensitive code, read `docs/research/journal.md`,
`docs/research/public-session-status.md`, and
`docs/heldout-debug-ledger.md`.

Append a timestamped entry to `docs/research/journal.md` after every material
diagnosis, implementation slice, regression result, leaderboard observation,
or priority change. Keep entries newest-at-bottom and use the journal's
template. Record the witness, earliest divergence, prediction, evidence,
decision, measured effect, falsified hypotheses, and next blocker. Never erase
or rewrite an older conclusion; append a correction that links back to it.

Update `docs/research/public-session-status.md` after each full engine-only
corpus run. Update `docs/architecture/original-c-lua-map.md` whenever the
understood ownership or call boundary changes.

## Evidence gates

Fixture-on scoring is a public-regression gate, not evidence of
generalization. Any claim about the real port or held-out readiness must include
an engine-only measurement:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

Before publishing, run the full engine-only suite and then the normal public
suite. `frozen/score.sh` overlays `frozen/terminal.js` and `frozen/storage.js`
onto `js/`; restore those generated copies before committing.

Prefer the earliest shared C/Lua divergence over later transcript symptoms.
Use exact-session replays only as regression witnesses, and label any bounded
behavior bridge explicitly in the journal.
