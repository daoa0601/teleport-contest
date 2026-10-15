import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { ARROW_TRAP, CORR, MM_NOGRP, NO_MINVENT, SCORR, STATUE_TRAP } from '../js/const.js';
import { CmapSymbol, cmapToGlyph } from '../js/glyph_numbers.js';
import { automaticSearch } from '../js/detect.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { createCorpstatAt } from '../js/mklev.js';
import { APPLE, STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { resetInputState } from '../js/input.js';
import { addTrap } from './support/level-state.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { floorObject } from './support/game-objects.js';
const PM_JACKAL = 12;
void test('hallucinating search describes discovered traps with imaginary names', async () => {
    const descriptions = new Set();
    for (let seed = 1; seed <= 80 && descriptions.size < 2; seed++) {
        const level = freshObjectRoom({ hero: { hallucinationTurns: 100 } });
        const trap = addTrap(level, ARROW_TRAP, 9, 9, { tseen: false });
        installPagerInput(resetInputState(), { expected: /You find/, limit: 1 });
        initRng(seed);
        await rhack('s'.charCodeAt(0));
        if (trap.tseen)
            descriptions.add(game._lastPlineMessage);
    }
    assert.ok(descriptions.size > 1, `Hallucinated discoveries should vary; received ${[...descriptions].join('; ')}`);
});
void test('blind searching remembers a discovered secret corridor by touch', async () => {
    const level = freshObjectRoom({ gameplaySeed: 811n });
    const passage = level.requireAt(9, 10);
    passage.typ = SCORR;
    passage.lit = passage.waslit = false;
    await makeBlinded(100, { talk: false });
    installPagerInput(resetInputState(), { expected: /hidden passage/, limit: 1 });
    for (let attempt = 0; attempt < 100 && passage.typ === SCORR; attempt++)
        await rhack('s'.charCodeAt(0));
    assert.equal(passage.typ, CORR, 'Searching must discover the adjacent passage');
    assert.equal(passage.remembered_glyph?.glyph, cmapToGlyph(CmapSymbol.corr));
    assert.match(game._pending_message, /You find a hidden passage\./);
    assert.equal(game.context.move, 1);
});
void test('searching feels an adjacent object hidden by a visible cloud', async () => {
    const level = freshObjectRoom();
    await floorObject(APPLE, 9, 10);
    level.regions = [{ kind: 'gas-cloud', visible: true, damage: 0, ttl: 10,
            heroFault: false, monsterIds: [], cells: [{ x: 9, y: 10 }] }];
    newsym(9, 10);
    assert.notEqual(level.requireAt(9, 10).remembered_glyph?.kind, 'object');
    await rhack('s'.charCodeAt(0));
    assert.equal(level.requireAt(9, 10).remembered_glyph?.kind, 'object');
    assert.equal(game.context.move, 1);
});
void test('blind searching at the western edge does not feel the unused map column', async () => {
    const level = freshObjectRoom({ heroX: 1, left: 1, right: 8 });
    await makeBlinded(100, { talk: false });
    const outside = level.requireAt(0, 10);
    assert.equal(outside.seenv, 0);
    await rhack('s'.charCodeAt(0));
    assert.equal(outside.seenv, 0);
    assert.equal(game.context.move, 1);
});
void test('finding a trap under a visible monster keeps the map and needs no acknowledgement', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const newt = await createMonsterAt('newt', 11, 10, MM_NOGRP | NO_MINVENT);
    newsym(newt.mx, newt.my);
    const trap = addTrap(level, ARROW_TRAP, 11, 10, { tseen: false });
    const input = resetInputState();
    let acknowledgements = 0;
    installPagerInput(input, { expected: /find an arrow trap/, limit: 1 });
    input.beforeRead = () => { acknowledgements++; };
    initRng(14n);
    await automaticSearch();
    assert.equal(trap.tseen, true);
    assert.equal(acknowledgements, 0, 'a visible monster does not obscure the remembered trap');
    assert.equal(game._pending_message, 'You find an arrow trap.');
    assert.equal(level.requireAt(11, 10).disp_glyph?.kind, 'monster');
});
void test('searching beside a statue trap releases its monster', async () => {
    const level = freshPlayableRoom({ role: 'wizard' });
    requirePlayingGame(game);
    const x = game.u.ux - 1;
    const y = game.u.uy - 1;
    initRng(9403n);
    const statue = await createCorpstatAt(STATUE, null, PM_JACKAL, x, y, 0);
    addTrap(level, STATUE_TRAP, x, y, { tseen: false });
    initRng(14n);
    await rhack('s'.charCodeAt(0));
    const released = level.monsters.find(monster => monster.mnum === PM_JACKAL && monster.mx === x && monster.my === y);
    assert.ok(released);
    assert.equal(released.mpeaceful, 0);
    assert.equal(statue.where, 'gone');
    assert.equal(level.traps.length, 0);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=search.test.js.map