import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { discoverArtifact } from '../js/artifacts.js';
import { flushPendingTopline, plineWithContinuation } from '../js/display.js';
import { BURN, DUST, ENGRAVE, ENGR_BLOOD, HEADSTONE, ICE, NO_MINVENT, PIT, STONE } from '../js/const.js';
import { engravingAt, makeEngravingAt, wipeHeroEngraving } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { canLetGo } from '../js/hero_inventory.js';
import { initRng } from '../js/rng.js';
import { pushKeys } from '../js/input.js';
import { AMULET_OF_REFLECTION, GOLD_PIECE, LOADSTONE, LONG_SWORD, ROCK, WAR_HAMMER } from '../js/object_data.js';
import { setPrimaryWeapon, setQuiverObject } from '../js/weapon_slots.js';
import { addInventoryObject, addInventoryWeapon, artifactObject } from './support/game-objects.js';
import { kickDirection, throwInventoryObject } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { addTrap } from './support/level-state.js';

for (const type of [DUST, ENGR_BLOOD] as const) {
    void test(`${type === DUST ? 'dust' : 'blood'} can be rubbed away under the hero`, () => {
        freshObjectRoom();
        makeEngravingAt(10, 10, '?', null, 0, type);
        const adjacent = makeEngravingAt(11, 10, '?', null, 0, type);

        wipeHeroEngraving(1);

        assert.equal(engravingAt(10, 10), null);
        assert.equal(engravingAt(11, 10), adjacent);
        assert.ok(adjacent !== null && adjacent !== undefined);
        assert.equal(adjacent.text, '?');
    });
}

for (const protectedMark of [
    { name: 'headstones', type: HEADSTONE },
    { name: 'indelible dust messages', type: DUST, nowipeout: true },
    { name: 'text burned into stone', type: BURN },
] as const) {
    void test(`ordinary hero wear preserves ${protectedMark.name}`, () => {
        freshObjectRoom();
        const engraving = makeEngravingAt(10, 10, '?', null, 0,
            protectedMark.type, { nowipeout: !!protectedMark.nowipeout });

        for (let count = 0; count < 64; count++) wipeHeroEngraving(3);

        assert.equal(engravingAt(10, 10), engraving);
        assert.ok(engraving !== null && engraving !== undefined);
        assert.equal(engraving.text, '?');
    });
}

for (const melted of [false, true] as const) {
    void test(`${melted ? 'text melted into ice' : 'engraved text'} wears one character at a time`, () => {
        freshObjectRoom();
        requireFixtureGame(game);
        if (melted) game.level.requireAt(10, 10).typ = ICE;
        const engraving = makeEngravingAt(10, 10, '??????????', null, 0,
            melted ? BURN : ENGRAVE);
        let damaged = false;

        for (let attempt = 0; attempt < 128; attempt++) {
            assert.ok(engraving !== null && engraving !== undefined);
            const before = engraving.text.replaceAll(' ', '').length;
            wipeHeroEngraving(3);
            const loss = before - engraving.text.replaceAll(' ', '').length;
            assert.ok(loss >= 0 && loss <= 1);
            damaged ||= loss > 0;
        }

        assert.ok(damaged);
    });
}

for (const condition of ['levitating', 'swallowed', 'pit-edge'] as const) {
    void test(`a ${condition} hero cannot rub the floor engraving`, () => {
        freshObjectRoom();
        requireFixtureGame(game);
        if (condition === 'levitating') game.u.levitating = true;
        if (condition === 'swallowed') game.u.uswallow = true;
        if (condition === 'pit-edge')
            addTrap(game.level, PIT, 10, 10, { tseen: true });
        const engraving = makeEngravingAt(10, 10, '?', null, 0, DUST);

        wipeHeroEngraving(3);

        assert.equal(engravingAt(10, 10), engraving);
        assert.ok(engraving !== null && engraving !== undefined);
        assert.equal(engraving.text, '?');
    });
}

void test('standing still can wear away dust during an ordinary world turn', async () => {
    let erased = false;
    for (let seed = 1; seed <= 512 && !erased; seed++) {
        const input = freshTurnRoom();
        makeEngravingAt(10, 10, '?', null, 0, DUST);
        initRng(BigInt(seed));
        input.feed('.\x1b');

        await moveloop_core();
        await moveloop_core();

        erased = engravingAt(10, 10) === null;
    }

    assert.ok(erased, 'random turn maintenance should rub the dust at least once');
});

for (const levitating of [false, true] as const) {
    for (const action of ['melee', 'kick monster', 'kick wall', 'throw rock'] as const) {
        void test(`${action} ${levitating ? 'cannot wear dust while levitating' : 'wears dust under the hero'}`, async () => {
            freshObjectRoom();
            requireFixtureGame(game);
            game.u.levitating = levitating;
            makeEngravingAt(10, 10, '?', null, 0, DUST);
            if (action === 'melee' || action === 'kick monster') {
                const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
                goblin.mpeaceful = false;
            }
            // C allows a levitating kick only with something to brace against.
            if (action.startsWith('kick')) game.level.requireAt(9, 10).typ = STONE;
            if (action === 'melee') {
                pushKeys('    ');
                await rhack('l'.charCodeAt(0));
            } else if (action === 'throw rock') {
                const rock = await addInventoryObject(ROCK);
                await throwInventoryObject(rock, 'l', [' ', ' ', ' ']);
            } else {
                if (action === 'kick wall') game.level.requireAt(11, 10).typ = STONE;
                await kickDirection('l', [' ', ' ', ' ']);
            }

            if (levitating) assert.equal(engravingAt(10, 10)?.text, '?');
            else assert.equal(engravingAt(10, 10), null);
        });
    }
}

for (const quivered of [false, true] as const) {
    void test(`${quivered ? 'quivered' : 'hand-thrown'} gold ${quivered ? 'wears' : 'does not wear'} floor dust`, async () => {
        freshObjectRoom();
        makeEngravingAt(10, 10, '?', null, 0, DUST);
        const gold = await addInventoryObject(GOLD_PIECE, { quan: 3 });
        if (quivered) await setQuiverObject(gold);

        await throwInventoryObject(gold, 'l', [' ', ' ']);

        if (quivered) assert.equal(engravingAt(10, 10), null);
        else assert.equal(engravingAt(10, 10)?.text, '?');
    });
}

for (const refusal of ['welded weapon', 'worn amulet', 'cursed loadstone', 'unwielded Mjollnir', 'heavy Mjollnir'] as const) {
    void test(`a rejected ${refusal} throw leaves the engraving and inventory intact`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        makeEngravingAt(10, 10, '?', null, 0, DUST);
        let item;
        if (refusal === 'welded weapon') {
            item = await addInventoryWeapon(LONG_SWORD, { cursed: true });
            await setPrimaryWeapon(item);
        } else if (refusal === 'worn amulet') {
            item = await addInventoryObject(AMULET_OF_REFLECTION);
            await wearHeroAccessory(item, 'uamul');
        } else if (refusal === 'cursed loadstone') {
            item = await addInventoryObject(LOADSTONE, { cursed: true, bknown: false });
        } else {
            item = await artifactObject('Mjollnir');
            item.invlet = 'a';
            item.where = 'inventory';
            game.inventory.push(item);
            if (refusal === 'heavy Mjollnir') await setPrimaryWeapon(item);
        }

        await throwInventoryObject(item, 'l', [' ', ' ', ' ']);

        assert.ok(game.inventory.includes(item));
        assert.equal(engravingAt(10, 10)?.text, '?');
        assert.equal(game.context.move, refusal === 'heavy Mjollnir' ? 1 : 0);
        if (refusal === 'cursed loadstone') assert.ok(item.bknown);
    });
}

void test('cancelling a throw or aiming at oneself does not wear floor dust', async () => {
    for (const direction of ['\x1b', '.'] as const) {
        freshObjectRoom();
        requireFixtureGame(game);
        makeEngravingAt(10, 10, '?', null, 0, DUST);
        const rock = await addInventoryObject(ROCK);

        await throwInventoryObject(rock, direction);

        assert.ok(game.inventory.includes(rock));
        assert.equal(engravingAt(10, 10)?.text, '?');
        assert.equal(game.context.move, 0);
    }
});

void test('an ordinary war hammer does not have Mjollnir throwing restrictions', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    makeEngravingAt(10, 10, '?', null, 0, DUST);
    const hammer = await addInventoryObject(WAR_HAMMER);

    await throwInventoryObject(hammer, 'l', [' ']);

    assert.ok(!game.inventory.includes(hammer));
    assert.equal(engravingAt(10, 10), null);
    assert.equal(game.context.move, 1);
});

void test('worn-item refusal takes precedence over aiming at oneself', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const amulet = await addInventoryObject(AMULET_OF_REFLECTION);
    await wearHeroAccessory(amulet, 'uamul');

    await throwInventoryObject(amulet, '.');

    assert.match(game._pending_message, /cannot throw something you are wearing/);
    assert.equal(game.uamul, amulet);
    assert.equal(game.context.move, 0);
});

void test('refusing to throw cursed loadstones reveals the curse without splitting them', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const stones = await addInventoryObject(LOADSTONE, { quan: 3, cursed: true, bknown: false });

    assert.equal(await canLetGo(stones, 'throw'), false);

    assert.ok(stones.bknown);
    assert.equal(stones.quan, 3);
    assert.match(game._pending_message, /cannot throw any of the stones!/);
});

void test('silent inventory release still discovers that a loadstone is cursed', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const stone = await addInventoryObject(LOADSTONE, { cursed: true, bknown: false });

    assert.equal(await canLetGo(stone), false);

    assert.ok(stone.bknown);
    assert.ok(game.inventory.includes(stone));
    assert.equal(game._pending_message || '', '');
});

void test('a fully identified Mjollnir uses its personal name in the wielding refusal', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const hammer = await artifactObject('Mjollnir', { rknown: true, invlet: 'a', where: 'inventory' });
    game.inventory.push(hammer);
    assert.ok(hammer.oartifact !== undefined);
    discoverArtifact(hammer.oartifact);

    await throwInventoryObject(hammer, 'l', [' ']);

    assert.equal(game._pending_message, 'The Mjollnir must be wielded before it can be thrown.');
});

void test('repeating a worn-item refusal does not require another message acknowledgment', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const amulet = await addInventoryObject(AMULET_OF_REFLECTION);
    await wearHeroAccessory(amulet, 'uamul');
    pushKeys(' ');
    await flushPendingTopline();
    await canLetGo(amulet, 'throw');

    await canLetGo(amulet, 'throw');

    assert.equal(game._pending_message, 'You cannot throw something you are wearing.');
});

void test('a repeated refusal does not duplicate a warning appended to another message', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const amulet = await addInventoryObject(AMULET_OF_REFLECTION);
    await wearHeroAccessory(amulet, 'uamul');
    pushKeys(' ');
    await flushPendingTopline();
    await plineWithContinuation('A rat squeaks.');
    await canLetGo(amulet, 'throw');

    await canLetGo(amulet, 'throw');

    assert.equal(game._pending_message, 'A rat squeaks.  You cannot throw something you are wearing.');
});

void test('acknowledging a warning does not make an identical refusal print again', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const amulet = await addInventoryObject(AMULET_OF_REFLECTION);
    await wearHeroAccessory(amulet, 'uamul');
    pushKeys(' ');
    await flushPendingTopline();
    await canLetGo(amulet, 'throw');
    pushKeys(' ');
    await flushPendingTopline();

    await canLetGo(amulet, 'throw');

    assert.equal(game._pending_message, '');
});
