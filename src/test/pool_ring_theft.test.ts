import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, OBJECT_NAMES, TWO_HANDED_SWORD } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

const RIN_INCREASE_ACCURACY = OBJECT_NAMES.indexOf('increase accuracy');

for (const rightHanded of [true, false]) {
    for (const twoHanded of [false, true]) {
        for (const primaryHand of [true, false]) {
            const hand = primaryHand === rightHanded ? 'right' : 'left';
            const blocked = primaryHand || twoHanded;
            void test(`a monkey ${blocked ? 'cannot steal' : 'can steal'} the ${hand}-hand ring under a welded ${twoHanded ? 'two-handed sword' : 'dagger'} of a ${rightHanded ? 'right' : 'left'}-handed hero`, async () => {
                freshObjectRoom({ hero: { rightHanded, uhp: 100, uhpmax: 100 } });
                requirePlayingGame(game);
                const ring = await addInventoryObject(RIN_INCREASE_ACCURACY);
                await wearHeroAccessory(ring, hand === 'left' ? 'uleft' : 'uright');
                const weapon = await addInventoryObject(twoHanded ? TWO_HANDED_SWORD : DAGGER, {
                    cursed: true, bknown: false, observed: false,
                });
                await setPrimaryWeapon(weapon);
                const monkey = await createMonsterAt('monkey', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
                monkey.mux = game.u.ux;
                monkey.muy = game.u.uy;
                const input = resetInputState();
                installPagerInput(input, { expected: /monkey/, limit: 12 });
                const messages: string[] = [];
                input.beforeRead = () => { messages.push(game._pending_message); };

                await performMonsterHeroAttack(monkey, game, { random: () => 0, rollOne: () => 1 });
                await flushPendingTopline();

                assert.equal(game.inventory.includes(ring), blocked, 'Only a free hand can give up its ring');
                assert.equal(monkey.minvent.includes(ring), !blocked);
                assert.equal(game[hand === 'left' ? 'uleft' : 'uright'], blocked ? ring : null);
                assert.equal(game.uwep, weapon, 'The monkey leaves the welded weapon in place');
                assert.equal(weapon.bknown, true, 'Checking the welded weapon reveals its curse');
                assert.match(messages.join('\n'), blocked
                    ? /The monkey tries to steal your ring of increase accuracy but gives up\./
                    : /The monkey stole/);
            });
        }
    }
}

void test('a nymph can take a ring from under a welded two-handed weapon', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const ring = await addInventoryObject(RIN_INCREASE_ACCURACY);
    await wearHeroAccessory(ring, 'uright');
    const sword = await addInventoryObject(TWO_HANDED_SWORD, { cursed: true });
    await setPrimaryWeapon(sword);
    const nymph = await createMonsterAt('water nymph', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    nymph.mux = game.u.ux;
    nymph.muy = game.u.uy;
    installPagerInput(resetInputState(), { expected: /nymph|She/, limit: 12 });

    await performMonsterHeroAttack(nymph, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();

    assert.ok(nymph.minvent.includes(ring));
    assert.equal(game.uright, null);
    assert.equal(game.uwep, sword);
});
