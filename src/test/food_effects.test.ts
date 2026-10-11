import { installPagerInput } from './support/pager-input.js';
import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { heroHasDrainResistance } from '../js/armor.js';
import { currentAttribute } from '../js/attrib.js';
import { woundHeroLegs } from '../js/hero_legs.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { A_DEX, A_STR, SICK_VOMITABLE } from '../js/const.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { pushKey, pushKeys, resetInputState } from '../js/input.js';
import { flushPendingTopline } from '../js/display.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    APPLE, CARROT, CORPSE, EGG, EUCALYPTUS_LEAF, FORTUNE_COOKIE,
    LUMP_OF_ROYAL_JELLY, SPRIG_OF_WOLFSBANE,
    OBJECT_NAMES,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { syncBlindness } from '../js/senses.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import {
    addInventoryObject, addInventoryWeapon,
} from './support/game-objects.js';
import { installHumanWerewolfHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

const HUMAN_WEREWOLF = MONSTER_NAME.indexOf('werewolf', 260);
const WEREWOLF = MONSTER_NAME.indexOf('werewolf');
const SILVER_SABER = OBJECT_NAMES.indexOf('silver saber');

void test('eating a carrot clears temporary blindness', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    requireFixtureGame(game);
    game.u.blindTurns = 12;
    game.u.ucreamed = 0;
    syncBlindness(game);
    const carrot = await addInventoryObject(CARROT, { age: game.moves });
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.blind, false);
    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.inventory.includes(carrot), false);
});

void test('eating an uncursed eucalyptus leaf cures illness and nausea',
    async () => {
        freshObjectRoom({ gameplaySeed: 45300n });
        requireFixtureGame(game);
        game.u.sick = true;
        game.u.sickTurns = 18;
        game.u.sickType = SICK_VOMITABLE;
        game.u.vomiting = true;
        game.u.vomitingTurns = 9;
        const leaf = await addInventoryObject(EUCALYPTUS_LEAF, {
            age: game.moves,
        });
        pushKey('a');
        pushKey(' ');

        await rhack('e'.charCodeAt(0));

        assert.equal(game.u.sick, false);
        assert.equal(game.u.sickTurns, 0);
        assert.equal(game.u.vomiting, false);
        assert.equal(game.u.vomitingTurns, 0);
        assert.equal(game.inventory.includes(leaf), false);
    });

void test('eating wolfsbane cures lycanthropy and ends beast form', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    requireFixtureGame(game);
    installHumanWerewolfHero({ beast: true });
    const wolfsbane = await addInventoryObject(SPRIG_OF_WOLFSBANE, {
        age: game.moves,
    });
    pushKey('a');
    pushKey(' ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.ulycn, -1);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.mh, 0);
    assert.equal(game.inventory.includes(wolfsbane), false);
});

void test('finishing a human werewolf corpse rejects a silver weapon', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    requireFixtureGame(game);
    const saber = await addInventoryWeapon(SILVER_SABER);
    const corpse = await addInventoryObject(CORPSE, {
        age: game.moves,
        corpsenm: HUMAN_WEREWOLF,
        name: 'human werewolf corpse',
    });
    await setPrimaryWeapon(saber, game);
    pushKey(corpse.invlet);
    pushKeys(' '.repeat(8));

    await rhack('e'.charCodeAt(0));
    for (let turn = 0; turn < 30 && game._occupation; turn++)
        await continueCountedCommand(game);

    assert.equal(game.u.ulycn, WEREWOLF);
    assert.equal(heroHasDrainResistance(game), true);
    assert.equal(game.uwep, null);
    assert.equal(game.inventory.includes(saber), false);
    assert.equal(
        floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy).includes(saber),
        true,
    );
});

void test('eating a cockatrice egg starts petrification', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    requireFixtureGame(game);
    const egg = await addInventoryObject(EGG, {
        age: game.moves,
        corpsenm: 10,
    });
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.stonedTurns, 5);
    assert.equal(game.u.stoned, true);
    assert.equal(game.inventory.includes(egg), false);
});

void test('eating royal jelly strengthens and heals the hero', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    requireFixtureGame(game);
    game.u.uhp = 5;
    game.u.uhpmax = 40;
    const dexterity = currentAttribute(A_DEX);
    await woundHeroLegs('left', 12);
    const strength = game.u.acurr.a[A_STR];
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY, {
        age: game.moves,
    });
    pushKeys('a   ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.acurr.a[A_STR], strength + 1);
    assert.ok(game.u.uhp > 5);
    assert.equal(game.u._woundedLegTurns, 0);
    assert.equal(currentAttribute(A_DEX), dexterity);
    assert.equal(game.inventory.includes(jelly), false);
});

void test('eating a cursed apple puts the hero to sleep', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    requireFixtureGame(game);
    const apple = await addInventoryObject(APPLE, {
        age: game.moves,
        cursed: true,
    });
    initRng(45300n);
    pushKeys('a  ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game._helplessReason, 'sleeping');
    assert.ok((game._helplessTurns ?? 0) >= 20);
    assert.ok((game._helplessTurns ?? 0) <= 30);
    assert.equal(game.inventory.includes(apple), false);
});

void test('reading a fortune cookie grants nutrition and literacy', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    requireFixtureGame(game);
    game.u.uhunger = 900;
    game.u.uconduct = {};
    const cookie = await addInventoryObject(FORTUNE_COOKIE, {
        age: game.moves,
    });
    pushKeys('a    ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.uhunger, 940);
    assert.equal(game.u.uconduct.literate, 1);
    assert.equal(game.inventory.includes(cookie), false);
});

void test('a tainted corpse is consumed and starts fatal sickness', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    requireFixtureGame(game);
    game.moves = 1000;
    const corpse = await addInventoryObject(CORPSE, {
        age: 1,
        corpsenm: 70,
        name: 'goblin corpse',
    });
    const messages: string[] = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /tainted|corpse|eat|food|sick|sickness|feel very sick/i, limit: 120 });
    input.beforeRead = () => {
        if (messages.length > 20) throw new Error('Unexpected repeated meal input');
        messages.push(game._pending_message || '');

    };
    input.feed(corpse.invlet);

    await rhack('e'.charCodeAt(0));
    await flushPendingTopline();

    assert.equal(game.inventory.includes(corpse), false);
    assert.equal(!!game._occupation, false);
    assert.ok((game.u.sickTurns ?? 0) >= 10);
    assert.ok((game.u.sickTurns ?? 0) <= 19);
    assert.ok(game.u.sickType !== null && game.u.sickType !== undefined);
    assert.ok(game.u.sickType & SICK_VOMITABLE);
    assert.match(messages.join(' '), /tainted/);
});

for (const level of [4, 30] as const) {
    void test(`finishing a wraith corpse grants experience at level ${level}`, async () => {
        freshObjectRoom({ hero: { ulevel: level }, gameplaySeed: 45300n });
        requireFixtureGame(game);
        const health = game.u.uhpmax;
        const corpse = await addInventoryObject(CORPSE, {
            age: game.moves, corpsenm: MONSTER_NAME.indexOf('wraith'),
        });
        pushKeys(corpse.invlet + ' '.repeat(60));

        await rhack('e'.charCodeAt(0));
        for (let turn = 0; turn < 30 && game._occupation; turn++)
            await continueCountedCommand(game);

        assert.equal(game.u.ulevel, Math.min(level + 1, 30));
        assert.ok(game.u.uhpmax > health);
        assert.equal(game.inventory.includes(corpse), false);
        assert.ok(!game._occupation);
    });
}
