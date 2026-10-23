import test from 'node:test';
import assert from 'node:assert/strict';

// C read.c:drop_boulder_on_player() names the conjured rocks with doname(),
// which observes them only when the hero can see.

import { rhack } from '../js/cmd.js';
import { MM_NOGRP, NO_MINVENT, W_ARMH } from '../js/const.js';
import { canSpotMonster } from '../js/display.js';
import { dropBoulderOnHero, dropBoulderOnMonster } from '../js/falling_boulder.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { BOULDER, ORCISH_HELM } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function rockRoom() {
    freshObjectRoom({ hero: { uhp: 200, uhpmax: 200 } });
    requireFixtureGame(game);
    initRng(7n);
}

void test('rocks seen falling on the hero are still felt as rocks after blindness', async () => {
    rockRoom();
    pushKeys(' '.repeat(10));

    await dropBoulderOnHero({ confused: true });
    assert.match(game._pending_message, /You are hit by \d+ rocks!/);
    setHeroBlindnessTurns(20);
    pushKeys(' '.repeat(10));
    await rhack(':'.charCodeAt(0));

    assert.match(game._pending_message, /You feel here \d+ rocks\./);
});

void test('rocks that fall on a blind hero are only felt as stones', async () => {
    rockRoom();
    setHeroBlindnessTurns(20);
    pushKeys(' '.repeat(10));

    await dropBoulderOnHero({ confused: true });
    assert.match(game._pending_message, /You are hit by \d+ stones!/);
    pushKeys(' '.repeat(10));
    await rhack(':'.charCodeAt(0));

    assert.match(game._pending_message, /You feel here \d+ stones\./);
});

void test('a helmet clang is only heard once fallen boulders hide the target', async () => {
    freshObjectRoom({ right: 20, hero: { uhp: 200, uhpmax: 200 } });
    requireFixtureGame(game);
    const { ux, uy } = game.u;
    const goblin = await createMonsterAt('goblin', ux + 3, uy, MM_NOGRP | NO_MINVENT);
    goblin.mhp = goblin.mhpmax = 100;
    await equipMonsterObject(goblin, await knownObject(ORCISH_HELM), W_ARMH);
    vision_recalc(0);
    assert.equal(canSpotMonster(goblin), true);
    // A boulder that already landed between them has not yet been seen
    // through; the next message's vision update hides the goblin.
    await floorObject(BOULDER, ux + 1, uy);
    vision_note_blocker_change(ux + 1, uy);
    const input = resetInputState();
    const pages: string[] = [];
    input.beforeRead = () => {
        pages.push(game._pending_message);
        input.feed(' ');
    };
    initRng(7n);

    await dropBoulderOnMonster(goblin.mx, goblin.my, { heroCaused: false });

    const prose = [...pages, game._pending_message].join('\n');
    assert.match(prose, /The goblin is hit by a boulder!/);
    assert.match(prose, /You hear a clanging sound\./);
    assert.doesNotMatch(prose, /Fortunately/);
});
