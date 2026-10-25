import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, ELVEN_CLOAK, LEATHER_ARMOR, LEATHER_CLOAK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
// C steal.c:steal() gives worn armor and accessories five selection tickets
// and every other carried object one; the highest ticket picks the plain
// unworn possession here.
void test('the theft draw can pick a lone unworn item among worn gear', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const cloak = await addInventoryObject(ELVEN_CLOAK);
    const dagger = await addInventoryObject(DAGGER);
    wearHeroArmor(cloak);
    const nymph = await createMonsterAt('water nymph', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    nymph.mux = game.u.ux;
    nymph.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /nymph|cloak|dagger/, limit: 12 });
    // rn2(6) draws ticket 5: the cloak's five tickets all lose, the dagger wins.
    await performMonsterHeroAttack(nymph, game, { random: limit => limit - 1, rollOne: () => 1 });
    await flushPendingTopline();
    assert.ok(nymph.minvent.includes(dagger), 'the dagger is the sixth ticket');
    assert.equal(game.uarmc, cloak, 'the cloak stays worn');
});
// C steal.c:steal() drops the cloak from the weighted pass while body armor
// is present, then rewrites a suit selection into the covering cloak.
void test('a nymph after a suited and cloaked hero leaves with the cloak', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    const cloak = await addInventoryObject(LEATHER_CLOAK);
    wearHeroArmor(suit);
    wearHeroArmor(cloak);
    const nymph = await createMonsterAt('water nymph', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    nymph.mux = game.u.ux;
    nymph.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /nymph|cloak|suit/, limit: 12 });
    await performMonsterHeroAttack(nymph, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();
    assert.ok(nymph.minvent.includes(cloak), 'the covering cloak is rewritten into the theft');
    assert.equal(game.uarm, suit, 'the suit stays worn');
});
//# sourceMappingURL=steal_item_weights.test.js.map