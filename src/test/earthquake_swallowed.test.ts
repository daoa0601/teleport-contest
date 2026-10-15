import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { DRUM_OF_EARTHQUAKE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('a swallowed drummer stays inside the monster that falls into a chasm', async () => {
    const input = freshTurnRoom({ heroLevel: 30, hero: { uhp: 1000, uhpmax: 1000 } });
    const worm = await createMonsterAt('ochre jelly', 11, 10);
    worm.mhp = worm.mhpmax = 1000;
    await installSwallowedHero(worm, 100);
    const drum = await addInventoryObject(DRUM_OF_EARTHQUAKE, { spe: 10 });
    const expected = /playing|thunderous|shaking|chasm|flee|digest|uncomfortable|jelly|goo|acid|covered|spit/;
    installPagerInput(input, { expected, limit: 150 });
    let pitFormed = false;
    for (let attempt = 0; attempt < 10 && !pitFormed; attempt++) {
        const hp = game.u.uhp;
        pushKeys(`a${drum.invlet}`);

        await moveloop_core();
        pitFormed = game.level?.traps.some(trap => trap.tx === 10 && trap.ty === 10 && trap.ttyp === PIT) ?? false;
        assert.equal(game.u.uhp, hp, 'The chasm damages the swallower, not the hero inside it');
        assert.equal(game.u.utrap ?? 0, 0);
        await finishAtCommandInput(input, moveloop_core, expected);
    }
    assert.equal(pitFormed, true, 'The earthquake must open a chasm under the swallower');
    assert.equal(worm.mtrapped, 1);
});
