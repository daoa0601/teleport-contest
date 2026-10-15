import { advanceHeroVomiting } from './support/condition-turn.js';
import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { A_STR, FAINTED, HUNGRY, NOT_HUNGRY, SATIATED, WEAK } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { wearEyewear } from '../js/eyewear.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { startHeroVomiting } from '../js/hero_illness.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    BLINDFOLD, DIAMOND, EGG, OBJECT_NUTRITION, POT_BOOZE, POT_FRUIT_JUICE,
} from '../js/object_data.js';
import { recordObjectKnowledge } from '../js/object_knowledge.js';
import { polymonHero } from '../js/polyself.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { teleportHeroAtWill } from '../js/teleport.js';
import { addInventoryObject, corpseObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';

function acknowledgeMessages() {
    const input = resetInputState();
    let reads = 0;
    input.display = {
        async readKey() {
            assert.ok(++reads < 80, 'nutrition effect requested too many acknowledgments');
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (/Do you want (?:your possessions identified|to see your attributes|an account of creatures vanquished|to see your conduct|to see the dungeon overview)\?/.test(screen)) {
                return 'n'.charCodeAt(0);
            }
            assert.match(screen, /--More--|\(end\)/, 'unexpected nutrition input prompt');
            return ' '.charCodeAt(0);
        },
    };
    return input;
}

for (const type of [POT_FRUIT_JUICE, POT_BOOZE] as const) {
    void test(`${type === POT_FRUIT_JUICE ? 'fruit juice' : 'booze'} bypasses choking and fullness delays`, async () => {
        // dodrink rejects a strangled hero before selection. A full stomach
        // alone exercises peffects' direct nutrition gain without choking.
        freshObjectRoom({ hero: { uhunger: 1980, uhs: SATIATED } });
        requireFixtureGame(game);
        const potion = await addInventoryObject(type, { blessed: true });
        recordObjectKnowledge(type);
        const input = acknowledgeMessages();
        assert.ok(potion.invlet);
        input.feed(potion.invlet);

        await rhack('q'.charCodeAt(0));

        assert.equal(game.u.uhunger, 2010);
        assert.equal(game.u.uhs, SATIATED);
        assert.equal(!!game.program_state.gameover, false);
        assert.equal(game._helplessTurns ?? 0, 0);
        assert.equal(game.inventory.includes(potion), false);
    });
}

void test('fruit juice restores hunger-weakened Strength through newuhs', async () => {
    freshObjectRoom({ hero: {
        uhunger: 35, uhs: WEAK, atemp: { a: [-1, 0, 0, 0, 0, 0] },
    } });
    requireFixtureGame(game);
    const potion = await addInventoryObject(POT_FRUIT_JUICE, { blessed: true });
    recordObjectKnowledge(POT_FRUIT_JUICE);
    const input = acknowledgeMessages();
    assert.ok(potion.invlet);
    input.feed(potion.invlet);

    await rhack('q'.charCodeAt(0));

    assert.equal(game.u.uhs, HUNGRY);
    assert.equal(game.u.atemp.a[A_STR], 0);
    assert.match(game._lastPlineMessage, /only feel hungry now/);
});

void test('the final nausea turn can cause a real faint instead of only changing nutrition', async () => {
    freshObjectRoom({ hero: {
        uhunger: 20, uhs: WEAK, atemp: { a: [-1, 0, 0, 0, 0, 0] },
    } });
    requireFixtureGame(game);
    acknowledgeMessages();
    startHeroVomiting({ turns: 1 });

    await advanceHeroVomiting();

    assert.equal(game.u.uhunger, 0);
    assert.equal(game.u.uhs, FAINTED);
    assert.equal(game.deaf, true);
    assert.equal(game._helplessTurns, 10);
});

void test('laying an egg spends nutrition after placing the real egg and can cause fainting', async () => {
    const level = freshObjectRoom();
    requireFixtureGame(game);
    const input = acknowledgeMessages();
    await polymonHero(MONSTER_NAME.indexOf('cockatrice'));
    game.flags.female = true;
    const nutrition = OBJECT_NUTRITION[EGG];
    assert.ok(nutrition !== undefined);
    game.u.uhunger = nutrition;
    game.u.uhs = HUNGRY;
    input.feed('sit\n');

    await rhack('#'.charCodeAt(0));

    const egg = floorObjectsAt(level, game.u.ux, game.u.uy).find(object => object.otyp === EGG);
    assert.ok(egg != null);
    assert.equal(egg.spe, 1);
    assert.equal(egg.where, 'floor');
    assert.equal(game.u.uhs, FAINTED);
    assert.equal(game._helplessTurns, 10);
});

void test('a cancelled wizard teleport still spends nutrition through the hunger owner', async () => {
    freshObjectRoom({
        flags: { debug: true, tips: false },
        hero: { uhunger: 100, uhs: HUNGRY },
    });
    requireFixtureGame(game);
    game._travelTipShown = true;
    const input = acknowledgeMessages();
    input.feed('\x1b');

    await rhack(20);

    assert.equal(game.u.uhunger, 0);
    assert.equal(game.u.uhs, FAINTED);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
});

function controlledTeleportRoom() {
    freshObjectRoom({
        flags: { pickup: true },
        hero: { ulevel: 12, uen: 50, uhunger: 100, uhs: HUNGRY },
    });
    grantIntrinsicProperty('teleportation', 'outside');
    grantIntrinsicProperty('teleportControl', 'outside');
    acknowledgeMessages();
}

void test('teleport at will completes actual pickup before nutrition causes a faint', async () => {
    controlledTeleportRoom();
    requireFixtureGame(game);
    const gem = await floorObject(DIAMOND, 12, 10);

    const result = await teleportHeroAtWill({ chooseDestination: async () => ({ x: 12, y: 10 }) });

    assert.equal(result.moved, true);
    assert.equal(game.inventory.includes(gem), true);
    assert.equal(game.u.uhunger, 0);
    assert.equal(game.u.uhs, FAINTED);
});

void test('a fatal teleport landing never spends its later nutrition cost', async () => {
    controlledTeleportRoom();
    requireFixtureGame(game);
    game.storage = memoryStorage();
    const blindfold = await addInventoryObject(BLINDFOLD);
    await wearEyewear(blindfold);
    const corpse = await corpseObject(MONSTER_NAME.indexOf('cockatrice'));
    placeCreatedObject(corpse, 12, 10);

    const result = await teleportHeroAtWill({ chooseDestination: async () => ({ x: 12, y: 10 }) });

    assert.equal(result.died, true);
    assert.equal(game.program_state.gameover, true);
    assert.equal(game.u.uhunger, 100);
});
