import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requirePlayingGame } from '../js/gstate.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const giantEel = MONSTER_NAME.indexOf('giant eel');
const jackal = MONSTER_NAME.indexOf('jackal');
const rothe = MONSTER_NAME.indexOf('rothe');
const whiteUnicorn = MONSTER_NAME.indexOf('white unicorn');
const fleshGolem = MONSTER_NAME.indexOf('flesh golem');

// The hero never sees into the far square, so a polymorph there is
// reported through the nose the way C newcham() -> usmellmon() does.
// Each sniff uses its own square so the previous form stays put.
async function unseenPolymorph(target: number, x: number) {
    game._pending_message = '';
    const monster = await createMonsterAt('chameleon', x, 10);
    const row = game.viz_array?.[10];
    if (!row) throw new Error('the fixture must install a visibility grid');
    row[x] = 0;
    const change = await changeMonsterForm(monster, target, game, { showMessage: true });
    assert.ok(change, 'the forced form change must happen');
    return game._pending_message;
}

void test('a hero smells a monster that polymorphs where it cannot be seen', async () => {
    freshObjectRoom({ gameplaySeed: 7n });
    requirePlayingGame(game);
    initRng(7n);

    assert.equal(await unseenPolymorph(giantEel, 11), 'You smell fish.');
    assert.equal(await unseenPolymorph(jackal, 12), 'You notice a dog smell.');
    assert.equal(await unseenPolymorph(rothe, 13), 'You notice a bovine smell.');
});

void test('a smell-free species stays silent even in a scented class', async () => {
    freshObjectRoom({ gameplaySeed: 7n });
    requirePlayingGame(game);
    initRng(7n);

    // White unicorns are held smell-free by the species switch so the
    // unicorn-class stable smell cannot fire for them.
    assert.equal(await unseenPolymorph(whiteUnicorn, 11), '');
});

void test('a hero without a sense of smell notices nothing', async () => {
    freshObjectRoom({ gameplaySeed: 7n });
    requirePlayingGame(game);
    initRng(7n);
    const original = game.u.umonnum;
    game.u.umonnum = fleshGolem;
    try {
        assert.equal(await unseenPolymorph(giantEel, 11), '');
    } finally {
        game.u.umonnum = original;
    }
});
