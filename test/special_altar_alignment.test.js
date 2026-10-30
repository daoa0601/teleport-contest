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
// returns, so a nonco-aligned altar always resolves through at least two
// rn2(2) draws and never becomes an unaligned AM_NONE altar. The Barbarian
// quest goal carries the level's only plain altar marked noncoaligned, so
// teleporting straight there shows the stored mask for every legal barbarian
// alignment. For a chaotic hero the possible masks are AM_LAWFUL (lawful
// second draw), or the third-draw values 3 and AM_NEUTRAL; for a neutral
// hero AM_LAWFUL, 3, or AM_CHAOTIC. AM_NONE is impossible under both.
const CHAOTIC_MASKS = new Set([AM_LAWFUL, 3, AM_NEUTRAL]);
const NEUTRAL_MASKS = new Set([AM_LAWFUL, 3, AM_CHAOTIC]);
const SEEDS = [13, 47, 103, 7, 29, 59];
for (const align of ['chaotic', 'neutral']) {
    for (const seed of SEEDS) {
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