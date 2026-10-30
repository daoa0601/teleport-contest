import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { requireGameLevel } from '../js/gstate.js';
import { AM_NONE, AM_CHAOTIC, AM_NEUTRAL, AM_LAWFUL, ALTAR, COLNO, ROWNO } from '../js/const.js';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
// C sp_lev.c:sp_amask_to_amask() passes noncoalignment() through the
// Align2amask() ternary macro (include/align.h). The macro's first
// comparison tests against A_NONE (-128), which noncoalignment() never
// returns, so a nonco-aligned altar always resolves through two or three
// rn2(2) draws. The third-draw branch stores the shifted mask 3 for a
// lawful final draw — a value a single-draw resolution can never produce,
// and one these pinned seeds really draw (verified against the native
// recorder, whose full-session replay matches this engine for the same
// seeds). The Barbarian quest goal carries the level's only plain altar
// marked noncoaligned, so teleporting straight there shows the stored mask
// for every legal barbarian alignment.
const CHAOTIC_MASKS = new Set([AM_LAWFUL, 3, AM_NEUTRAL]);
const NEUTRAL_MASKS = new Set([AM_LAWFUL, 3, AM_CHAOTIC]);
const PINNED_THIRD_DRAW = {
    // align -> [seed, expected mask] pairs that only the re-evaluated ternary
    // can produce.
    chaotic: [[47, 3], [101, 3]],
    neutral: [[29, 3]],
};
const BREADTH_SEEDS = [13, 103, 7, 59];
for (const align of ['chaotic', 'neutral']) {
    for (const [seed, expected] of PINNED_THIRD_DRAW[align] ?? []) {
        void test(`noncoaligned Bar-goal altar stores the third-draw mask for a ${align} hero (seed ${seed})`, async () => {
            const level = await reachBarbarianGoal(seed, align);
            const altar = findGoalAltar(level);
            assert.ok(altar, 'the Bar-goal altar must exist');
            assert.equal((altar.flags ?? 0) & 0x7, expected, 'only the re-evaluated Align2amask ternary stores this mask');
        });
    }
    for (const seed of BREADTH_SEEDS) {
        void test(`noncoaligned Bar-goal altar stays aligned for a ${align} hero (seed ${seed})`, async () => {
            const level = await reachBarbarianGoal(seed, align);
            const altar = findGoalAltar(level);
            assert.ok(altar, 'the Bar-goal altar must exist');
            const mask = (altar.flags ?? 0) & 0x7;
            assert.notEqual(mask, AM_NONE, 'a noncoaligned altar never becomes unaligned');
            const allowed = align === 'chaotic' ? CHAOTIC_MASKS : NEUTRAL_MASKS;
            assert.ok(allowed.has(mask), `a ${align} hero draws the altar mask from {${[...allowed].map(String).join(', ')}}, saw ${mask}`);
        });
    }
}
function findGoalAltar(level) {
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            const cell = level.at(x, y);
            if (cell && cell.typ === ALTAR)
                return cell;
        }
    return null;
}
async function reachBarbarianGoal(seed, align) {
    const driver = [
        { type: 'keys', value: '#levelchange\r', dismissMore: true },
        { type: 'answer-prompt', prompt: 'To what experience level', value: '30\r', dismissMore: true },
        { type: 'select-menu-entry', target: 'Bar-goal', openKeys: 'm\x16', dismissMore: true },
        { type: 'keys', value: '\x1b', dismissMore: true },
    ];
    const segment = {
        seed,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:Nomad,role:barbarian,race:human,gender:male,align:' + align + '\n'
            + 'OPTIONS=!legacy,!tutorial,!news,time,symset:DECgraphics\n'
            + 'OPTIONS=playmode:debug\nOPTIONS=!autopickup\n',
        driver,
    };
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const sessionDriver = createSessionDriver(segment.driver);
    for (let input = 0; input < 5000; input++) {
        const screen = screenText(capturedScreen(engine));
        let key;
        try {
            key = sessionDriver.nextKey(screen.split('\n'));
        }
        catch (cause) {
            throw new Error(`driver failed at input ${input}\n${screen}`, { cause });
        }
        if (key === null)
            break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
        if ((engine.state.u?.uz?.dnum ?? 0) !== 0)
            break;
    }
    return requireGameLevel(engine.state);
}
//# sourceMappingURL=special_altar_alignment.test.js.map