import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { glyphAt } from '../js/display.js';
import { prepareMapPositionHighlights, selectMapPosition } from '../js/getpos.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const TARGETS = [{ x: 9, y: 8 }, { x: 9, y: 12 }, { x: 11, y: 11 }];

async function highlightedSpecies(heroY: number, phase: 'install' | 'exit') {
    freshObjectRoom({ heroY, hero: { hallucinationTurns: 20 } });
    for (const { x, y } of TARGETS)
        await createMonsterAt('jackal', x, y, MM_NOGRP | NO_MINVENT);
    const isValidLocation = (x: number, y: number) =>
        TARGETS.some(spot => spot.x === x && spot.y === y);
    if (phase === 'install') {
        initRng(1n);
        prepareMapPositionHighlights(isValidLocation);
    } else {
        const input = resetInputState();
        input.feed('.');
        await selectMapPosition({
            start: { x: game.u.ux, y: game.u.uy },
            prompt: 'Where do you want to hit?', goal: 'the spot to hit',
            isValidLocation, preserveMap: true,
            afterPaint: () => { initRng(1n); },
        });
    }
    return TARGETS.map(({ x, y }) => {
        const glyph = glyphAt(x, y);
        assert.ok(glyph?.kind === 'monster', `A hallucinated monster is visible at ${x},${y}.`);
        return glyph.mnum;
    });
}

for (const phase of ['install', 'exit'] as const) {
    void test(`valid-square ${phase} redraws give the same hallucinations regardless of distance from the hero`, async () => {
        const nearLowerMonster = await highlightedSpecies(10, phase);
        const nearUpperMonster = await highlightedSpecies(7, phase);

        for (const [index, spot] of TARGETS.entries()) {
            assert.equal(nearLowerMonster[index], nearUpperMonster[index],
                `The hallucinated species at ${spot.x},${spot.y} must not depend on distance sorting.`);
        }
    });
}
