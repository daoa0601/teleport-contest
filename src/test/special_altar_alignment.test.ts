import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import type { GameMap } from '../js/game.js';
import { requireGameLevel } from '../js/gstate.js';
import { AM_LAWFUL, AM_NEUTRAL, AM_CHAOTIC, ALTAR, COLNO, ROWNO } from '../js/const.js';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import type { SessionAction } from '../scripts/lib/session-types.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

// C sp_lev.c:sp_amask_to_amask() passes noncoalignment() through the
// Align2amask() ternary macro, which re-evaluates its argument once per
// comparison. A nonco-aligned altar therefore consumes two rn2(2) draws
// when the second draw is lawful, and three otherwise, and stores the mask
// that evaluation produces. The Barbarian quest goal has the level's only
// plain altar marked noncoaligned, so teleporting straight there isolates
// the altar draws as the first rn2(2) pair of the level burst.
for (const seed of [13, 47, 103]) {
    void test(`noncoaligned altar on Bar-goal resolves through repeated draws (seed ${seed})`, async () => {
        const outcome = await reachBarbarianGoal(seed);
        const altar = findGoalAltar(outcome.level);
        assert.ok(altar, 'the Bar-goal altar must exist');
        const mask = altar.flags ?? 0;
        const draws = outcome.draws;
        assert.ok(draws.length >= 2, `the altar must consume at least two rn2(2) draws, saw ${draws.length}`);
        if (draws[1] === 0)
            assert.equal(draws.length, 2, 'a lawful second draw ends the comparison chain');
        else
            assert.equal(draws.length, 3, 'a chaotic second draw forces a third draw');
        assert.equal(mask & 0x7, expectedMask(draws) & 0x7,
            `altar mask must follow the C re-evaluation table for draws ${draws}`);
    });
}

// A neutral hero's noncoalignment() returns lawful for a 0 draw and chaotic
// for a 1 draw (sp_lev.c:1852). The re-evaluating macro yields lawful when
// the second draw is lawful, otherwise the third draw picks chaotic or
// neutral.
function expectedMask(draws: number[]): number {
    if (draws[1] === 0)
        return AM_LAWFUL;
    return draws[2] === 1 ? AM_CHAOTIC : AM_NEUTRAL;
}

function findGoalAltar(level: GameMap): { typ: number; flags?: number } | null {
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++) {
            const cell = level.at(x, y);
            if (cell && cell.typ === ALTAR)
                return cell;
        }
    return null;
}

async function reachBarbarianGoal(seed: number): Promise<{ level: GameMap; draws: number[] }> {
    const driver: SessionAction[] = [
        { type: 'keys', value: '#levelchange\r', dismissMore: true },
        { type: 'answer-prompt', prompt: 'To what experience level', value: '30\r', dismissMore: true },
        { type: 'select-menu-entry', target: 'Bar-goal', openKeys: 'm\x16', dismissMore: true },
        { type: 'keys', value: '\x1b', dismissMore: true },
    ];
    const segment = {
        seed,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:Nomad,role:barbarian,race:human,gender:male,align:neutral\n'
            + 'OPTIONS=!legacy,!tutorial,!news,time,symset:DECgraphics\n'
            + 'OPTIONS=playmode:debug\nOPTIONS=!autopickup\n',
        driver,
    };
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const sessionDriver = createSessionDriver(segment.driver);
    let burstStart = 0;
    let previousQuest = false;
    for (let input = 0; input < 5000; input++) {
        const screen = screenText(capturedScreen(engine));
        let key: string | null;
        try {
            key = sessionDriver.nextKey(screen.split('\n'));
        }
        catch (cause) {
            throw new Error(`driver failed at input ${input}\n${screen}`, { cause });
        }
        if (key === null)
            break;
        const logLength = engine.getRngLog().length;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
        const onQuest = (engine.state.u?.uz?.dnum ?? 0) !== 0;
        if (onQuest && !previousQuest)
            burstStart = logLength;
        previousQuest = onQuest;
    }
    // Burst prefix before the altar: the nhlib alignment shuffle consumes
    // one rn2(2) and the level_init lighting draw another. The altar draws
    // are the rn2(2) entries that follow those two and stop at the first
    // object identity draw.
    const burst = engine.getRngLog().slice(burstStart);
    let binarySeen = 0;
    const draws: number[] = [];
    for (const entry of burst) {
        const binary = /^rn2\(2\)=([01])$/.exec(entry);
        if (binary) {
            binarySeen++;
            if (binarySeen > 2 && draws.length < 3)
                draws.push(Number(binary[1]));
            continue;
        }
        if (binarySeen > 2)
            break;
    }
    return { level: requireGameLevel(engine.state), draws };
}
