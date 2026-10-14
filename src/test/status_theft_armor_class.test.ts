import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { findArmorClass, removeHeroArmor, wearHeroArmor } from '../js/armor.js';
import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { useUpInventoryStack } from '../js/hero_inventory.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES, SMALL_SHIELD } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a disenchanter hit retains the old armor class through its effectiveness message', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const shield = await addInventoryObject(SMALL_SHIELD, { spe: 3 });
    wearHeroArmor(shield);
    findArmorClass();
    await bot();
    const disenchanter = await createMonsterAt('disenchanter', 11, 10, MM_ANGRY | NO_MINVENT);
    disenchanter.mux = game.u.ux;
    disenchanter.muy = game.u.uy;
    resetInputState().feed(' '.repeat(10));

    await performMonsterHeroAttack(disenchanter, game, { random: () => 99, rollOne: () => 1 });

    assert.equal(shield.spe, 2);
    assert.equal(game.u.uac, 6);
    await flush_screen(1);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /AC:6\b/);
    findArmorClass();
    await bot();
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /AC:7\b/);
});

void test('a nymph stealing an accuracy ring preserves pending shield AC through its removal pager', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const shield = await addInventoryObject(SMALL_SHIELD, { spe: 3 });
    wearHeroArmor(shield);
    findArmorClass();
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('increase accuracy'), {
        dknown: true, typeKnown: false, known: false, bknown: false,
    });
    await wearHeroAccessory(ring, 'uright');
    const nymph = await createMonsterAt('water nymph', 11, 10, MM_ANGRY | NO_MINVENT);
    nymph.mux = game.u.ux;
    nymph.muy = game.u.uy;
    await bot();
    await removeHeroArmor(shield, game, { deferArmorClass: true });
    await useUpInventoryStack(shield);
    const input = resetInputState();
    let removalPages = 0;
    input.display = { async readKey() {
        const message = requireScreenRow(0).map(cell => cell.ch).join('');
        if (message.includes('removes')) {
            assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /AC:6\b/);
            removalPages++;
        }
        return 32;
    } };

    await performMonsterHeroAttack(nymph, game, { random: () => 0, rollOne: () => 1 });

    assert.equal(removalPages, 1);
    assert.ok(nymph.minvent.includes(ring));
    findArmorClass();
    await flush_screen(1);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /AC:10\b/);
});
