import test from 'node:test';
import assert from 'node:assert/strict';

import { heroHasDrainResistance } from '../js/armor.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { A_DEX, A_STR, SICK_VOMITABLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
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

test('eating a carrot clears temporary blindness', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    game.u.blindTurns = 12;
    game.u.ucreamed = 0;
    syncBlindness(game);
    const carrot = addInventoryObject(CARROT, { age: game.moves });
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.blind, false);
    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.inventory.includes(carrot), false);
});

test('eating an uncursed eucalyptus leaf cures illness and nausea',
    async () => {
        freshObjectRoom({ gameplaySeed: 45300n });
        game.u.sick = true;
        game.u.sickTurns = 18;
        game.u.sickType = SICK_VOMITABLE;
        game.u.vomiting = true;
        game.u.vomitingTurns = 9;
        const leaf = addInventoryObject(EUCALYPTUS_LEAF, {
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

test('eating wolfsbane cures lycanthropy and ends beast form', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    installHumanWerewolfHero({ beast: true });
    const wolfsbane = addInventoryObject(SPRIG_OF_WOLFSBANE, {
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

test('finishing a human werewolf corpse rejects a silver weapon', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    const saber = addInventoryWeapon(SILVER_SABER);
    const corpse = addInventoryObject(CORPSE, {
        age: game.moves,
        corpsenm: HUMAN_WEREWOLF,
        name: 'human werewolf corpse',
    });
    setPrimaryWeapon(saber, game);
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
        game.level.objects[game.u.ux][game.u.uy].includes(saber),
        true,
    );
});

test('eating a cockatrice egg starts petrification', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    const egg = addInventoryObject(EGG, {
        age: game.moves,
        corpsenm: 10,
    });
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.stonedTurns, 5);
    assert.equal(game.u.stoned, true);
    assert.equal(game.inventory.includes(egg), false);
});

test('eating royal jelly strengthens and heals the hero', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    game.u.uhp = 5;
    game.u.uhpmax = 40;
    game.u._woundedLegTurns = 12;
    game.u._woundedLegSide = 'left';
    game.u.acurr.a[A_DEX]--;
    const strength = game.u.acurr.a[A_STR];
    const jelly = addInventoryObject(LUMP_OF_ROYAL_JELLY, {
        age: game.moves,
    });
    pushKeys('a   ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.acurr.a[A_STR], strength + 1);
    assert.ok(game.u.uhp > 5);
    assert.equal(game.u._woundedLegTurns, 0);
    assert.equal(game.inventory.includes(jelly), false);
});

test('eating a cursed apple puts the hero to sleep', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    const apple = addInventoryObject(APPLE, {
        age: game.moves,
        cursed: true,
    });
    initRng(45300n);
    pushKeys('a  ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game._helplessReason, 'sleeping');
    assert.ok(game._helplessTurns >= 20);
    assert.ok(game._helplessTurns <= 30);
    assert.equal(game.inventory.includes(apple), false);
});

test('reading a fortune cookie grants nutrition and literacy', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    game.u.uhunger = 900;
    game.u.uconduct = {};
    const cookie = addInventoryObject(FORTUNE_COOKIE, {
        age: game.moves,
    });
    pushKeys('a    ');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.u.uhunger, 940);
    assert.equal(game.u.uconduct.literate, 1);
    assert.equal(game.inventory.includes(cookie), false);
});

test('a tainted corpse is consumed and starts fatal sickness', async () => {
    freshObjectRoom({ gameplaySeed: 45300n });
    game.moves = 1000;
    const corpse = addInventoryObject(CORPSE, {
        age: 1,
        corpsenm: 70,
        name: 'goblin corpse',
    });
    pushKey('a');

    await rhack('e'.charCodeAt(0));

    assert.equal(game.inventory.includes(corpse), false);
    assert.equal(!!game._occupation, false);
    assert.ok(game.u.sickTurns >= 10);
    assert.ok(game.u.sickTurns <= 19);
    assert.ok(game.u.sickType & SICK_VOMITABLE);
    assert.match(game._pending_message, /tainted/);
});
