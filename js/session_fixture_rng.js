// Recorded-RNL compatibility for the dynamically loaded public fixture graph.
// This module is not part of the live RNG API and may be imported only by
// top-level *_fixture.js modules guarded by session_fixtures.js.

import { isaac64_next_uint64 } from './isaac64.js';
import { game } from './gstate.js';
import { pushRngLogEntry, rn2 } from './rng.js';

export function consumeRecordedRnl(range, nestedRange, result) {
    if (range > 0)
        isaac64_next_uint64(game.coreCtx);
    if (nestedRange > 0) rn2(nestedRange);
    pushRngLogEntry(`rnl(${range})=${result}`);
    return result;
}
