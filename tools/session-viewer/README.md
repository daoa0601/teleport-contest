# Session Viewer

A zero-build divergence viewer for the Teleport Coding Challenge.
Loads a recorded session, drives your JS port to completion, and
shows where its output drifts from the canonical recording — frame
by frame, on a per-PRNG-call timeline + a 24×80 map.

```
┌─ canon ──────────────────────────────────────────────────────┐
│ ▌ ▌ ▌ █ █ ▌ ▌ ▌ ▌ ▌  ← bar height = log2(arg) of each rn2() │
│ ▌ █ █ ▌ █ ▌                                                  │
└─ js ─────────────────────────────────────────────────────────┘
        click anywhere on the timeline to jump to that step

┌─ map (your js port's screen, with diff overlay) ─┬─ details ─┐
│  …NetHack 5.0.0…                                 │  cursor   │
│  …                                               │  rng      │
│  Welcome, Wizard…  (red bg = char wrong)         │  msg line │
│                    (yellow bg = attr wrong)      │           │
│                    (blue cursor markers)         │           │
└──────────────────────────────────────────────────┴───────────┘
```

## Usage

```bash
# from the repository root
python3 -m http.server 8080
# then open http://localhost:8080/tools/session-viewer/ in a browser
```

Pick a public session from the dropdown, or use **load file…** to
load any `.session.json` you have on disk. The viewer:

1. Fetches the session,
2. Calls `runSegment()` from your `js/jsmain.js` once per segment
   (no interactive stepping — all data is collected up front),
3. Decodes both the canonical and the JS-port screens into a
   24×80 grid and diffs them per cell,
4. Draws the per-call timeline + map.

## What you see

**Timelines (top).** Three rows sharing one X axis:

- `canon` and `js` — one bar per PRNG call. Bar height is
  `log2(bound + 1)` for `rn2(bound)`/`rnd(N)`/etc. — taller bars
  mean bigger ranges (more decision-making). Bar color encodes
  match status:
  - dark sepia — call matches between canon and JS
  - red — same call name but value diverged
  - brown-orange — call only canon side made
  - purple — call only JS side made
- `screen` — one column per step, stacked into up to three thin
  bands when the rendered screen differs:
  - red — at least one cell's character differs
  - yellow — char matches but attr/color differs
  - blue — cursor position differs

A bold dark-brown vertical bar marks segment boundaries (multi-game
or save+restore sessions). Click anywhere on the timeline to jump
to that step. Use ←/→ (Shift for ×10) to step through.

**Map (center).** A 24×80 viewport with three switchable modes
(buttons above the grid):

- `canon` — the recorded canonical screen, with red/yellow/blue
  highlights showing where your JS port diverges
- `js` — your port's screen, with the same divergence highlights
- `diff` — overlay of both, surfacing whichever side has the
  more informative pixel at each cell

**Details (right).** Cursor coordinates, the per-step PRNG diff
list (color-coded `match`/`diff`/`missing`/`extra`), and the
rendered message line.

## Pass/fail decoration

If a `.cache/session-results.json` advisory file exists (written
automatically by your local PS test runner), the dropdown shows
✓/✗/· prefixes per session and a tooltip with the RNG/Screen
match counts. Run `npm run score` (or whatever your runner is) to
refresh it. Without the advisory the marks all read `·`.

## URL state

The viewer mirrors UI state into the URL hash so a refresh or a
shared link lands on the same place:

- `#session=<substring>` — picks the first dropdown entry whose
  name contains the substring
- `#step=<n>` — initial step (zero-indexed)
- `#view=canon|js|diff` — initial map mode (default `js`)
- `?js=<url>` — override which JS port to drive (for ad-hoc
  testing against an alternate `runSegment` implementation)

## Notes

- All work happens at session-load time; scrubbing is pure DOM.
- The viewer reads `getScreens()`, `getCursors()`, and (optionally)
  `getRngSlices()` off your `NethackGame` instance, so all three
  must accumulate cumulatively across segments.
- Sessions live under `sessions/`; `manifest.json` lists what the
  dropdown should offer. The file picker still works without one.
