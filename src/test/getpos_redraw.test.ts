import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flush_screen, glyphAt, map_invisible } from '../js/display.js';
import { prepareMapPositionHighlights, selectMapPosition } from '../js/getpos.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';

void test('entering and moving the targeting cursor preserves unseen monster information', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    for (const x of [11, 20]) {
        const monster = await createMonsterAt('xorn', x, 10, MM_NOGRP | NO_MINVENT);
        monster.minvis = 1;
        monster.mpeaceful = false;
        monster.m_lev = 8;
    }
    map_invisible(11, 10);
    game.u.warning = true;
    await flush_screen(1);
    const input = resetInputState();
    input.feed('l\x1b');

    const selected = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Choose a location.', goal: 'a location',
        afterPaint: () => {
            assert.equal(requireScreenCell(10, 11).ch, 'I', 'Targeting keeps the remembered unseen attacker');
            assert.equal(requireScreenCell(19, 11).ch, ' ', 'Targeting does not discover a new warning');
        },
    });

    assert.equal(selected, null);
});

const TARGETS = [{ x: 9, y: 8 }, { x: 9, y: 12 }, { x: 11, y: 11 }];

async function highlightedSpecies(heroY: number, phase: 'install' | 'exit', marked = false) {
    freshObjectRoom({ heroY, hero: { hallucinationTurns: 20 }, iflags: { bgcolors: false } });
    for (const { x, y } of TARGETS)
        await createMonsterAt('jackal', x, y, MM_NOGRP | NO_MINVENT);
    const isValidLocation = (x: number, y: number) =>
        TARGETS.some(spot => spot.x === x && spot.y === y);
    if (phase === 'install') {
        initRng(1n);
        prepareMapPositionHighlights(isValidLocation);
    } else {
        const input = resetInputState();
        input.feed(marked ? '$.' : '.');
        await selectMapPosition({
            start: { x: game.u.ux, y: game.u.uy },
            prompt: 'Where do you want to hit?', goal: 'the spot to hit',
            isValidLocation,
            afterPaint: () => { initRng(1n); },
        });
    }
    return TARGETS.map(({ x, y }) => {
        const glyph = glyphAt(x, y);
        assert.ok(glyph?.kind === 'monster', `A hallucinated monster is visible at ${x},${y}.`);
        return glyph.mnum;
    });
}

void test('exiting marked targeting restores the same hallucinations as exiting unmarked targeting', async () => {
    const unmarked = await highlightedSpecies(10, 'exit');
    const marked = await highlightedSpecies(10, 'exit', true);

    for (const [index, spot] of TARGETS.entries()) {
        assert.equal(marked[index], unmarked[index],
            `Removing marks must not reroll the restored monster at ${spot.x},${spot.y}.`);
    }
});

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

void test('targeting does not repaint a status change nothing marked for redisplay', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    game.u.uen = game.u.uenmax = 7;
    game.context.botl = true;
    await flush_screen(1);
    // A magic trap's energy surge raises Pw without marking the status line.
    game.u.uen = game.u.uenmax = 9;
    const input = resetInputState();
    input.feed('\x1b');

    let statusLine = '';
    await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy }, prompt: 'Choose a location.', goal: 'a location',
        afterPaint: () => { statusLine = requireScreenRow(23).map(cell => cell.ch).join(''); },
    });

    assert.match(statusLine, /Pw:7\(7\)/);
});

void test('requesting a targeting refresh redraws the current status values', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    game.u.uen = game.u.uenmax = 7;
    game.context.botl = true;
    await flush_screen(1);
    game.u.uen = game.u.uenmax = 9;
    const input = resetInputState();
    input.feed('\x12');
    const selection = selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy }, prompt: 'Choose a location.', goal: 'a location',
    });

    await input.waitUntilBlocked();
    try {
        const statusLine = requireScreenRow(23).map(cell => cell.ch).join('');
        assert.match(statusLine, /Pw:9\(9\)/);
    } finally {
        input.feed('\x1b');
        await selection;
    }
});
