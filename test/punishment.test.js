import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { HEAVY_IRON_BALL, SCR_PUNISHMENT } from '../js/object_data.js';
import { punishHero } from '../js/punishment.js';
import { addInventoryObject } from './support/game-objects.js';
import { readInventoryObject } from './support/commands.js';
import { installPolymorphedHero, installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObjectsAt } from './support/level-state.js';

for (const cause of ['blessed', 'confused']) {
    test(`a ${cause} punishment scroll creates guilt without a ball and chain`, async () => {
        freshObjectRoom({ hero: { confusionTurns: cause === 'confused' ? 5 : 0 } });
        const scroll = addInventoryObject(SCR_PUNISHMENT, { blessed: cause === 'blessed' });

        await readInventoryObject(scroll, ' '.repeat(20));

        assert.equal(!!game.u.punished, false);
        assert.equal(scroll.where, 'gone');
        assert.match(game._pending_message, /feel guilty/);
    });
}

test('a second cursed punishment scroll adds twice the normal ball weight', async () => {
    freshObjectRoom();
    pushKeys(' '.repeat(40));
    await punishHero();
    const weight = game.uball.owt;
    const scroll = addInventoryObject(SCR_PUNISHMENT, { cursed: true });

    // Finish the first effect's acknowledgements before starting a command.
    resetInputState();
    await readInventoryObject(scroll, ' '.repeat(20));

    assert.equal(game.uball.owt, weight + 320);
});

test('an amorphous hero slips free and leaves an ordinary iron ball', async () => {
    freshObjectRoom();
    installPolymorphedHero('gray ooze');
    pushKeys(' '.repeat(20));

    await punishHero();

    assert.equal(!!game.u.punished, false);
    assert.ok(floorObjectsAt(game.level, game.u.ux, game.u.uy)
        .some(object => object.otyp === HEAVY_IRON_BALL));
});

test('a swallowed hero gains a ball and chain without placing them outside the monster', async () => {
    freshObjectRoom();
    const worm = await createMonsterAt('purple worm', 10, 10);
    installSwallowedHero(worm);
    pushKeys(' '.repeat(20));

    await punishHero();

    assert.equal(game.u.punished, true);
    assert.ok(game.uball && game.uchain);
    const pile = floorObjectsAt(game.level, game.u.ux, game.u.uy);
    assert.equal(pile.includes(game.uball), false);
    assert.equal(pile.includes(game.uchain), false);
});
