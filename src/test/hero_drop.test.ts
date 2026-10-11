import { createMonsterAt } from './support/monsters.js';
import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { ALTAR, ROOM, SINK } from '../js/const.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import {
    dropHeroObject, dropInventoryObjectAtHero,
} from '../js/hero_drop.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { shopkeeperName } from '../js/monster_name.js';
import { createStaffedShop } from './support/shop.js';
import { wearHeroArmor } from '../js/armor.js';

const DAGGER = OBJECT_NAMES.indexOf('dagger');
const COCKATRICE = OBJECT_NAMES.length; // placeholder-free tests below use real indices

// C do.c:714-720/722-734: a wielded dagger drops cleanly; welded or worn
// items are refused by canletgo before any state changes.
void test('dropping a wielded weapon releases the slot and lands it', async () => {
    freshObjectRoom({ gameplaySeed: 81 });
    requireFixtureGame(game);
    const dagger = await addInventoryObject(DAGGER, { invlet: 'a' });
    await setPrimaryWeapon(dagger, game);
    pushKeys(' ');

    const took = await dropHeroObject(dagger);

    assert.equal(took, true);
    assert.equal(game.uwep ?? game.u?.uwep ?? null, null);
    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(dagger.where, 'floor');
    assert.deepEqual([dagger.ox, dagger.oy], [game.u.ux, game.u.uy]);
    assert.equal(dagger.how_lost, 2); // LOST_DROPPED
});

// C do.c:736-751: the swallowed barrier names the digester's stomach.
void test('dropping while swallowed describes the stomach', async () => {
    freshObjectRoom({ gameplaySeed: 82 });
    requireFixtureGame(game);
    const gem = await addInventoryObject(OBJECT_NAMES.indexOf('diamond'),
        { invlet: 'a' });
    game.u.uswallow = 1;
    game.u.ustuck = await createMonsterAt('purple worm', 10, 10);
    game._pending_message = '';
    pushKeys(' ');

    const took = await dropHeroObject(gem);

    assert.equal(took, true);
    assert.match(game._pending_message, /into the purple worm's stomach/);
    assert.ok(game.u.ustuck !== null && game.u.ustuck !== undefined);
    assert.ok(game.u.ustuck.minvent
        ? game.u.ustuck.minvent.includes(gem)
        : true);
});

// C do.c:748 yobjnam: an unpaid object swallowed mid-sentence keeps the
// shopkeeper's proper name capitalized; only the generic articles
// ("Your"/"The") lowercase.
void test('an unpaid swallowed drop names the owning shopkeeper', async () => {
    freshObjectRoom({ gameplaySeed: 86 });
    requireFixtureGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 11, keeperY: 10 });
    shopkeeper.eshk.shknam = 'Kabale';
    const dagger = await addInventoryObject(OBJECT_NAMES.indexOf('dagger'),
        { invlet: 'a', unpaid: true });
    game.u.uswallow = 1;
    game.u.ustuck = await createMonsterAt('purple worm', 10, 10);
    game._pending_message = '';
    pushKeys(' ');

    const took = await dropHeroObject(dagger);

    assert.equal(took, true);
    // the stolen-value line names the owner too; the pending topline holds
    // whichever message landed last, so both orderings are acceptable as
    // long as the possessive keeps its capital
    const keeperName = shopkeeperName(shopkeeper);
    assert.equal(keeperName, 'Kabale');
    assert.match(game._pending_message,
        new RegExp(`(drop ${keeperName}'s dagger into|owe ${keeperName} )`));
    assert.doesNotMatch(game._pending_message, /[0-9a-z]kabale/);
});

// C do.c:753-757: rings over a sink divert to the sink owner.
void test('a ring over a sink diverts to the sink owner', async () => {
    freshObjectRoom({ gameplaySeed: 83 });
    requireFixtureGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = SINK;
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('levitation'),
        { invlet: 'a' });
    pushKeys(' ');

    const took = await dropHeroObject(ring);

    assert.equal(took, true);
    assert.equal(game.inventory.includes(ring), false);
});

// C do.c:946-962: a bare-handed petrifying corpse prompts before dropping.
void test('a cockatrice corpse prompts for bare hands', async () => {
    freshObjectRoom({ gameplaySeed: 84 });
    requireFixtureGame(game);
    const corpse = await knownObject(OBJECT_NAMES.indexOf('corpse'), {
        invlet: 'a', where: 'inventory',
    });
    corpse.corpsenm = 10; // cockatrice
    game.inventory = [corpse];
    game._pending_message = '';
    pushKeys('n\n');

    const took = await dropHeroObject(corpse);

    // the paranoid line editor owns the prompt; the observable refusal is
    // the failed action with the corpse still carried
    assert.equal(took, false);
    assert.ok(game.inventory.includes(corpse));
    assert.equal(corpse.where, 'inventory');
});

// C do.c:786-796 dropx(): the shared core extracts and lands the object.
void test('dropInventoryObjectAtHero performs the whole dropx sequence', async () => {
    freshObjectRoom({ gameplaySeed: 85 });
    requireFixtureGame(game);
    const gem = await addInventoryObject(OBJECT_NAMES.indexOf('diamond'),
        { invlet: 'a' });
    pushKeys(' ');

    await dropInventoryObjectAtHero(gem);

    assert.equal(game.inventory.includes(gem), false);
    assert.equal(gem.where, 'floor');
    assert.ok(floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy).includes(gem));
});
