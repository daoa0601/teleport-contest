import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { IRONBARS, NO_MINVENT, W_NONDIGGABLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { DAGGER, MIRROR, POT_ACID, POT_WATER, WAR_HAMMER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

async function strikeBars(seed = 71n): Promise<string> {
    const input = resetInputState();
    installPagerInput(input, { expected: /shatter|odor|bars|Clonk|wakes up/, limit: 8 });
    const pager = input.display;
    assert.ok(pager);
    const messages: string[] = [];
    input.display = {
        async readKey(): Promise<number> {
            messages.push(game._pending_message);
            return pager.readKey();
        },
    };
    pushKeys('Fl');
    initRng(seed);
    await rhack(0);
    messages.push(game._pending_message);
    return messages.join('\n');
}

void test('force fighting bars strikes with the wielded dagger and wakes a nearby sleeper', async () => {
    const level = freshObjectRoom();
    const bars = level.requireAt(11, 10);
    bars.typ = IRONBARS;
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger);
    const sleeper = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
    sleeper.msleeping = 1;

    const messages = await strikeBars();

    assert.match(messages, /Clonk!/);
    assert.equal(sleeper.msleeping, 0);
    assert.equal(game.uwep, dagger);
    assert.equal(dagger.where, 'inventory');
    assert.equal(bars.typ, IRONBARS);
    assert.equal(game.u.ux, 10);
    assert.equal(game.context.move, 1);
});

for (const quantity of [1, 3]) {
    void test(`striking bars with ${quantity} wielded water potion${quantity === 1 ? '' : 's'} breaks just one`, async () => {
        const level = freshObjectRoom();
        level.requireAt(11, 10).typ = IRONBARS;
        const potion = await addInventoryObject(POT_WATER, { quan: quantity });
        await setPrimaryWeapon(potion);

        const messages = await strikeBars();

        assert.match(messages, /potion of water.*shatters!/);
        assert.equal(game.u.ux, 10);
        assert.equal(game.context.move, 1);
        if (quantity === 1) {
            assert.equal(potion.where, 'gone');
            assert.equal(game.uwep, null);
            assert.equal(game.inventory.includes(potion), false);
        } else {
            assert.equal(potion.quan, 2);
            assert.equal(game.uwep, potion);
            assert.equal(potion.where, 'inventory');
            assert.equal(game.inventory.length, 1);
        }
    });
}

for (const protectedBars of [false, true]) {
    void test(`a wielded acid potion ${protectedBars ? 'leaves protected bars intact' : 'dissolves bars'} on impact`, async () => {
        const level = freshObjectRoom();
        const bars = level.requireAt(11, 10);
        bars.typ = IRONBARS;
        bars.wall_info = protectedBars ? W_NONDIGGABLE : 0;
        const acid = await addInventoryObject(POT_ACID);
        await setPrimaryWeapon(acid);

        const messages = await strikeBars();

        assert.equal(acid.where, 'gone');
        assert.equal(game.uwep, null);
        assert.equal(bars.typ === IRONBARS, protectedBars);
        assert.match(messages, protectedBars ? /hissing noise/ : /iron bars are dissolved!/);
        assert.equal(game.u.ux, 10);
    });
}

void test('breaking a wielded mirror against bars costs the hero luck', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = IRONBARS;
    const mirror = await addInventoryObject(MIRROR);
    await setPrimaryWeapon(mirror);
    game.u.uluck = 4;

    await strikeBars();

    assert.equal(mirror.where, 'gone');
    assert.equal(game.uwep, null);
    assert.equal(game.u.uluck, 2);
});

void test('a melee hammer blow can break bars without releasing the hammer', async () => {
    const level = freshObjectRoom();
    const bars = level.requireAt(11, 10);
    bars.typ = IRONBARS;
    const hammer = await addInventoryObject(WAR_HAMMER, { spe: 10 });
    await setPrimaryWeapon(hammer);

    const messages = await strikeBars(3n);

    assert.match(messages, /You break the bars apart!/);
    assert.notEqual(bars.typ, IRONBARS);
    assert.equal(game.uwep, hammer);
    assert.equal(hammer.where, 'inventory');
    assert.equal(game.u.ux, 10);
});
