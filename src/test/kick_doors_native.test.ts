import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CON, A_DEX, A_STR, DOOR, D_BROKEN, D_CLOSED, D_WARNED, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { kickDirection } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('a giant breaks a closed door even with weak attributes', async () => {
    const level = freshPlayableRoom({ seed: 11n });
    requirePlayingGame(game);
    game.u.mh = game.u.mhmax = 100;
    game.u.mtimedone = 100;
    setHeroSpecies(MONSTER_NAME.indexOf('giant'));
    for (const attribute of [A_STR, A_DEX, A_CON]) game.u.acurr.a[attribute] = 3;
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    await kickDirection('l', ' '.repeat(10));

    assert.equal(door.doormask, D_BROKEN);
});

void test('a deaf hero feels a failed door kick as a thwack', async () => {
    const level = freshPlayableRoom({ seed: 11n, hero: { deafTurns: 100 } });
    requirePlayingGame(game);
    for (const attribute of [A_STR, A_DEX, A_CON]) game.u.acurr.a[attribute] = 3;
    level.requireAt(11, 10).typ = DOOR;
    level.requireAt(11, 10).doormask = D_CLOSED;

    await kickDirection('l');

    assert.equal(level.requireAt(11, 10).doormask, D_CLOSED);
    assert.equal(game._pending_message, 'Thwack!!');
});

void test('town watchmen warn at the first failed door kick and arrest at the second', async () => {
    const level = freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    level.flags.has_town = true;
    for (const attribute of [A_STR, A_DEX, A_CON]) game.u.acurr.a[attribute] = 3;
    const guard = await createMonsterAt('watchman', 10, 9, MM_NOGRP | NO_MINVENT);
    guard.mpeaceful = 1;
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    for (let attempts = 0; attempts < 30 && !((door.looted ?? 0) & D_WARNED); attempts++) {
        door.doormask = D_CLOSED;
        resetInputState();
        await kickDirection('l', ' '.repeat(20));
        if (!guard.mpeaceful) break;
    }
    assert.ok((door.looted ?? 0) & D_WARNED, 'A witnessed failed kick must mark the warning on this door.');
    assert.equal(guard.mpeaceful, 1);

    resetInputState();
    await kickDirection('l', ' '.repeat(20));

    assert.equal(guard.mpeaceful, 0);
});
