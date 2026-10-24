import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT, TRAPDOOR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mfndpos } from '../js/monmove.js';
import { monsterKnowsTrap } from '../js/trap_knowledge.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a thinking monster born in the Castle avoids unfamiliar-looking trapdoors', async () => {
    const level = freshObjectRoom({ heroX: 15, heroY: 12 });
    requirePlayingGame(game);
    game.stronghold_level = { ...game.u.uz, flags: { town: false }, alignment: null };
    const xorn = await createMonsterAt('xorn', 10, 10, MM_NOGRP | NO_MINVENT);
    const trap = addTrap(level, TRAPDOOR, 11, 10);
    const destinations = await mfndpos(xorn, game);
    assert.equal(monsterKnowsTrap(xorn, trap), true);
    assert.equal(destinations.some(square => square.x === 11 && square.y === 10), false);
});
void test('a mindless Castle monster is born without trapdoor knowledge', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.stronghold_level = { ...game.u.uz, flags: { town: false }, alignment: null };
    const zombie = await createMonsterAt('human zombie', 12, 10, MM_NOGRP | NO_MINVENT);
    assert.equal(monsterKnowsTrap(zombie, { ttyp: TRAPDOOR }), false);
});
//# sourceMappingURL=castle_trap_knowledge.test.js.map