import { requireScreenRow, requireScreenCell } from './support/screen.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requirePlayingGame } from '../js/gstate.js';
import { flush_screen, swallowed } from '../js/display.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME, monsterCanEngulf } from '../js/monster_data.js';
import { NO_MINVENT, PIT } from '../js/const.js';
import { monsterHasStoneResistance } from '../js/monster_resistance.js';
import { AMULET_OF_LIFE_SAVING, BOULDER, CORPSE, EGG, POT_POLYMORPH } from '../js/object_data.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { dropInventoryObject, throwInventoryObject } from './support/commands.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { cancelMonster } from '../js/monster_cancellation.js';
import { moveloop_core } from '../js/allmain.js';
import { freshTurnRoom } from './support/playable-room.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { installPolymorphedHero, installSwallowedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

async function messageLine() {
    await flush_screen();
    return requireScreenRow(0).map(cell => cell.ch).join('').trim();
}

void test('a swallowed hero breaks out when a named engulfer becomes solid and cannot engulf', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    setMonsterGivenName(worm, 'Maw');
    installSwallowedHero(worm);
    initRng(17n);
    const input = resetInputState();
    const changing = changeMonsterForm(worm, MONSTER_NAME.indexOf('little dog'),
        game, { showMessage: true });
    const blocked = await Promise.race([
        input.waitUntilBlocked().then(() => true),
        changing.then(() => false),
    ]);
    try {
        assert.equal(blocked, true, 'breakout feedback must wait for acknowledgement');
        const message = requireScreenRow(0).map(cell => cell.ch).join('');
        assert.match(message, /You break out of Maw!/);
    } finally {
        input.feed(' '.repeat(12));
        await changing;
    }
    const change = await changing;

    assert.equal(Boolean(game.u.uswallow), false);
    assert.equal(game.u.ustuck, null);
    assert.equal(worm.mhp, 1);
    assert.notDeepEqual([worm.mx, worm.my], [game.u.ux, game.u.uy]);
    assert.equal(change?.message, null);
});

void test('a light form releases the swallowed hero without breakout damage', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    installSwallowedHero(worm);
    initRng(17n);
    pushKeys(' '.repeat(12));

    await changeMonsterForm(worm, MONSTER_NAME.indexOf('yellow light'), game, { showMessage: true });

    assert.equal(Boolean(game.u.uswallow), false);
    assert.ok(worm.mhp > 1);
    const message = await messageLine();
    assert.match(message, /yellow light/);
    assert.doesNotMatch(message, /break out|emerge from|expelled|regurgitated/);
});

for (const [heroForm, newForm, remainsHeld] of [
    [null, 'little dog', false],
    [null, 'python', true],
    ['python', 'little dog', true],
    ['python', 'fog cloud', false],
] satisfies [string | null, string, boolean][]) {
    void test(`${heroForm || 'human'} hero and ${newForm} retain their hold: ${remainsHeld}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        if (heroForm) installPolymorphedHero(heroForm);
        const bear = await createMonsterAt('owlbear', 11, 10);
        game.u.ustuck = bear;
        initRng(17n);

        await changeMonsterForm(bear, MONSTER_NAME.indexOf(newForm));

        assert.equal(game.u.ustuck === bear, remainsHeld);
        assert.equal(await messageLine(), '');
    });
}

for (const saved of [false, true]) {
    void test(`swallowed polymorph food ${saved ? 'resumes after life saving' : 'stops at a fatal breakout landing'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1 } });
        requirePlayingGame(game);
        const worm = await createMonsterAt('purple worm', 11, 10);
        installSwallowedHero(worm);
        let amulet;
        if (saved) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
            assert.equal(game.uamul, amulet);
        }
        const boulder = await addObjectToMonsterInventory(worm, await knownObject(BOULDER));
        assert.ok(boulder);
        assert.equal(worm.minvent.includes(boulder), true);
        const corpse = await addInventoryObject(CORPSE, {
            corpsenm: MONSTER_NAME.indexOf('chameleon'), age: game.moves,
        });
        addTrap(game.level, PIT, game.u.ux, game.u.uy);
        initRng(1n);

        await dropInventoryObject(corpse, ' '.repeat(50));

        assert.equal(Boolean(game.u.uswallow), false);
        assert.notEqual(worm.mnum, MONSTER_NAME.indexOf('purple worm'));
        assert.equal(monsterCanEngulf(worm), false);
        assert.equal(worm.mhp, 1);
        assert.equal(Boolean(game.program_state.gameover), !saved);
        assert.equal(worm.minvent.includes(boulder), !saved);
        if (saved) {
            assert.ok(game.u.uhp > 0);
            assert.ok(amulet);
            assert.equal(game.inventory.includes(amulet), false);
            assert.equal(corpse.where, 'gone');
            assert.ok(floorObjectsAt(game.level, worm.mx, worm.my).includes(boulder));
        }
    });
}

void test('a new engulfing form repaints the stomach without releasing or moving the hero', async () => {
    freshObjectRoom({ flags: { color: true } });
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    installSwallowedHero(worm);
    swallowed(true);
    await flush_screen();
    const x = game.u.ux, y = game.u.uy;
    const oldColor = requireScreenCell(x, y + 1).color;
    assert.equal(Number.isInteger(oldColor), true);
    initRng(17n);

    const fireVortex = MONSTER_NAME.indexOf('fire vortex');
    assert.equal(monsterCanEngulf({ mnum: fireVortex }), true);
    await changeMonsterForm(worm, fireVortex);
    await flush_screen();

    assert.equal(Boolean(game.u.uswallow), true);
    assert.equal(game.u.ustuck, worm);
    assert.deepEqual([game.u.ux, game.u.uy], [x, y]);
    assert.deepEqual([worm.mx, worm.my], [x, y]);
    assert.notEqual(requireScreenCell(x, y + 1).color, oldColor);
});

for (const saved of [false, true]) {
    void test(`a swallowed polymorph potion ${saved ? 'finishes after life saving' : 'stops at fatal expulsion'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1 } });
        requirePlayingGame(game);
        const worm = await createMonsterAt('purple worm', 11, 10);
        installSwallowedHero(worm);
        let amulet;
        if (saved) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
            assert.equal(game.uamul, amulet);
        }
        const boulder = await addObjectToMonsterInventory(worm, await knownObject(BOULDER));
        assert.ok(boulder);
        const potion = await addInventoryObject(POT_POLYMORPH);
        addTrap(game.level, PIT, game.u.ux, game.u.uy);
        initRng(1n);

        await throwInventoryObject(potion, 'l', Array.from({ length: 50 }, () => ' '));

        assert.equal(Boolean(game.u.uswallow), false);
        assert.notEqual(worm.mnum, MONSTER_NAME.indexOf('purple worm'));
        assert.equal(monsterCanEngulf(worm), false);
        assert.equal(worm.mhp, 1);
        assert.equal(Boolean(game.program_state.gameover), !saved);
        assert.equal(worm.minvent.includes(boulder), !saved);
        assert.equal(potion.where, saved ? 'gone' : 'floor');
        if (saved) {
            assert.ok(game.u.uhp > 0);
            assert.ok(amulet);
            assert.equal(game.inventory.includes(amulet), false);
            assert.ok(floorObjectsAt(game.level, worm.mx, worm.my).includes(boulder));
        } else {
            assert.ok(floorObjectsAt(game.level, 11, 10).includes(potion));
        }
    });
}

void test('a swallowed vampire reversion preserves the native nameless suffix', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const vampire = await createMonsterAt('vampire', 11, 10);
    await changeMonsterForm(vampire, MONSTER_NAME.indexOf('fog cloud'));
    assert.equal(vampire.cham, MONSTER_NAME.indexOf('vampire'));
    installSwallowedHero(vampire);
    const input = resetInputState();

    const changing = changeMonsterForm(vampire, MONSTER_NAME.indexOf('vampire'));
    const blocked = await Promise.race([
        input.waitUntilBlocked().then(() => true),
        changing.then(() => false),
    ]);
    try {
        assert.equal(blocked, true);
        const text = requireScreenRow(0).map(cell => cell.ch).join('');
        assert.match(text,
            /You emerge from the fog cloud which was a shapeshifted the vampire!/);
    } finally {
        input.feed(' '.repeat(20));
        await changing;
    }
    assert.equal(Boolean(game.u.uswallow), false);
    assert.equal(vampire.mhp, 1);
});

for (const saved of [false, true]) {
    void test(`cancelling a swallower ${saved ? 'finishes after life saving' : 'stops at fatal natural-form restoration'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1 } });
        requirePlayingGame(game);
        const vampire = await createMonsterAt('vampire', 11, 10);
        await changeMonsterForm(vampire, MONSTER_NAME.indexOf('fog cloud'));
        installSwallowedHero(vampire);
        const baseForm = vampire.cham;
        assert.equal(baseForm, MONSTER_NAME.indexOf('vampire'));
        let amulet;
        if (saved) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
            assert.equal(game.uamul, amulet);
        }
        addTrap(game.level, PIT, game.u.ux, game.u.uy);
        pushKeys(' '.repeat(40));
        initRng(1n);

        const result = await cancelMonster(vampire, { attackLevel: 12 });

        assert.equal(result.cancelled, true);
        assert.equal(Boolean(game.u.uswallow), false);
        assert.equal(Boolean(game.program_state.gameover), !saved);
        assert.equal(Boolean(result.heroDied), !saved);
        assert.equal(vampire.mnum, baseForm);
        assert.equal(vampire.cham, saved ? -1 : baseForm);
        if (saved) {
            assert.ok(game.u.uhp > 0);
            assert.ok(amulet);
            assert.equal(game.inventory.includes(amulet), false);
        }
    });

    void test(`natural shape changing ${saved ? 'continues the world turn after life saving' : 'stops later monsters after fatal expulsion'}`, async () => {
        freshTurnRoom();
        requirePlayingGame(game);
        game.u.uhp = 1;
        const observer = await createMonsterAt('little dog', 15, 10);
        observer.mfrozen = 2;
        observer.mcanmove = 0;
        const vampire = await createMonsterAt('vampire', 11, 10);
        await changeMonsterForm(vampire, MONSTER_NAME.indexOf('fog cloud'));
        installSwallowedHero(vampire);
        vampire.mhp = 1;
        for (const monster of game.level.monsters) monster.movement = 0;
        let amulet;
        if (saved) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
            assert.equal(game.uamul, amulet);
        }
        addTrap(game.level, PIT, game.u.ux, game.u.uy);
        pushKeys('m.' + ' '.repeat(60) + 'm.');
        initRng(1n);

        await moveloop_core();
        await moveloop_core();

        assert.equal(Boolean(game.u.uswallow), false);
        assert.equal(vampire.mnum, MONSTER_NAME.indexOf('vampire'));
        assert.equal(Boolean(game.program_state.gameover), !saved);
        assert.equal(observer.mfrozen, saved ? 1 : 2);
        if (saved) {
            assert.ok(game.u.uhp > 0);
            assert.ok(amulet);
            assert.equal(game.inventory.includes(amulet), false);
        }
    });
}

for (const saved of [false, true]) {
    void test(`a petrifying egg in a swallower ${saved ? 'resumes physical damage after life saving' : 'stops on fatal natural-form recovery'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1 } });
        requirePlayingGame(game);
        const shifter = await createMonsterAt('sandestin', 11, 10, NO_MINVENT);
        await changeMonsterForm(shifter, MONSTER_NAME.indexOf('purple worm'));
        installSwallowedHero(shifter);
        assert.equal(shifter.cham, MONSTER_NAME.indexOf('sandestin'));
        assert.equal(monsterHasStoneResistance(shifter), false);
        let amulet;
        if (saved) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
            assert.equal(game.uamul, amulet);
        }
        const egg = await addInventoryObject(EGG, {
            corpsenm: MONSTER_NAME.indexOf('cockatrice'), age: game.moves,
        });
        addTrap(game.level, PIT, game.u.ux, game.u.uy);
        initRng(1n);

        await throwInventoryObject(egg, 'l', Array.from({ length: 50 }, () => ' '));

        assert.equal(Boolean(game.u.uswallow), false);
        assert.equal(shifter.mnum, MONSTER_NAME.indexOf('sandestin'));
        // C uhitm.c:1189,1216: regained stone resistance resumes the egg's
        // one point of physical damage, killing the one-HP restored body.
        assert.equal(shifter.mhp, saved ? 0 : 1);
        assert.equal(Boolean(shifter.dead), saved);
        assert.equal(Boolean(game.program_state.gameover), !saved);
        assert.equal(egg.where, 'gone');
        if (saved) {
            assert.ok(game.u.uhp > 0);
            assert.ok(amulet);
            assert.equal(game.inventory.includes(amulet), false);
        }
    });
}
