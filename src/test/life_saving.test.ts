import type { InputGate } from '../js/input.js';
import { loadScoreRecords } from '../js/score_records.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { A_CON, LAVAPOOL, NO_MINVENT, POOL } from '../js/const.js';
import { heroLiquidEffects } from '../js/hack.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { flushPendingTopline } from '../js/display.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, DAGGER } from '../js/object_data.js';
import { discardMonsterInventory } from '../js/monster_drop.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { pickupAtHero } from '../js/pickup.js';
import { carriedShopBill, unpaidObjectCost } from '../js/shk.js';
import { rileShopkeeper } from '../js/shop_damage.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';

void test('life saving consumes the worn amulet and restores the hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const input = resetInputState();

    await dismissRecoveryPagers(input, loseHeroHp(100, 'a falling rock'));

    assert.ok(game.u.uhp > 0);
    assert.equal(game.u.umortality, 1);
    assert.ok(!game.inventory.includes(amulet));
    assert.equal(game.uamul, null);
    assert.equal(amulet.owornmask, 0);
    assert.equal(amulet.where, 'gone');
});

void test('a life-saving amulet remains payable after it crumbles', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const amulet = await floorObject(AMULET_OF_LIFE_SAVING, 10, 10);
    const input = resetInputState();
    await dismissRecoveryPagers(input, pickupAtHero());
    const price = unpaidObjectCost(amulet);
    assert.ok(price > 0);
    await dismissRecoveryPagers(input, flushPendingTopline());
    await dismissRecoveryPagers(input, wearHeroAccessory(amulet, 'uamul'));

    await dismissRecoveryPagers(input, loseHeroHp(100, 'a falling rock'));

    assert.ok(game.u.uhp > 0);
    assert.ok(!game.inventory.includes(amulet));
    assert.equal(game.uamul, null);
    const amountOwed = carriedShopBill(shopkeeper)
        .reduce((total, item) => total + item.price, 0);
    assert.equal(amountOwed, price);
});

function visibleScreen(): string {
    assert.ok(game.nhDisplay);
    return game.nhDisplay.grid
        .map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}

async function waitsForInput(input: InputGate, operation: Promise<unknown>): Promise<boolean> {
    return Promise.race([
        input.waitUntilBlocked().then(() => true),
        operation.then(() => false),
    ]);
}

async function dismissRecoveryPagers(
    input: InputGate, operation: Promise<unknown>, finishCommand = false,
): Promise<void> {
    let commandFinished = false;
    for (let page = 0; page < 40; page++) {
        if (!await waitsForInput(input, operation)) return;
        const screen = visibleScreen();
        if (screen.includes('--More--')) {
            input.feed(' ');
            continue;
        }
        assert.ok(finishCommand && !commandFinished,
            `Unexpected recovery input: ${screen}`);
        assert.ok(game.nhDisplay);
        assert.equal(game.nhDisplay.cursorCol, game.u.ux - 1,
            `Expected the command cursor after recovery: ${screen}`);
        assert.equal(game.nhDisplay.cursorRow, game.u.uy + 1,
            `Expected the command cursor after recovery: ${screen}`);
        input.feed('\x1b');
        commandFinished = true;
    }
    assert.fail(`Recovery exceeded 40 pages: ${visibleScreen()}`);
}

async function dismissUntilMessage(
    input: InputGate, operation: Promise<unknown>, message: string,
    prompt: 'pager' | 'question' = 'pager',
): Promise<void> {
    for (let page = 0; page < 20; page++) {
        if (!await waitsForInput(input, operation)) break;
        const screen = visibleScreen();
        const pager = screen.includes('--More--');
        if (screen.includes(message) && (prompt === 'question' ? !pager : pager)) return;
        assert.ok(pager, `Unexpected input before ${message}: ${screen}`);
        input.feed(' ');
    }
    assert.fail(`Expected an input pause at ${message}; displayed: ${visibleScreen()}`);
}

for (const [cause, terrain] of [['drowning', POOL], ['burning', LAVAPOOL]] as const) {
    void test(`${cause} leaves the amulet worn until its recovery messages are dismissed`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        for (let x = game.u.ux - 1; x <= game.u.ux + 1; x++) {
            for (let y = game.u.uy - 1; y <= game.u.uy + 1; y++)
                game.level.requireAt(x, y).typ = terrain;
        }
        const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
        await wearHeroAccessory(amulet, 'uamul');
        const constitution = game.u.acurr.a[A_CON];
        const input = resetInputState();

        const entering = heroLiquidEffects();
        try {
            await dismissUntilMessage(input, entering, 'You feel much better!');
            assert.equal(game.u.uhp, 0);
            assert.equal(game.u.acurr.a[A_CON], constitution);
            assert.equal(game.uamul, amulet);
            assert.ok(game.inventory.includes(amulet));
        } finally {
            await dismissRecoveryPagers(input, entering);
        }

        assert.ok(game.u.uhp > 0);
        assert.equal(game.u.acurr.a[A_CON], constitution - 1);
        assert.equal(game.uamul, null);
        assert.equal(amulet.where, 'gone');
    });
}

for (const dismissal of [' ', '\x1b']) {
    void test(`life saving after a monster attack survives ${dismissal === ' ' ? 'space' : 'Escape'} at the death message`, async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
        await wearHeroAccessory(amulet, 'uamul');
        const attacker = await createMonsterAt('jackal', 11, 10, NO_MINVENT);
        attacker.mpeaceful = false;
        attacker.movement = 12;
        game.u.uhp = 1;
        game.u.uac = 20;
        const constitution = game.u.acurr.a[A_CON];
        input.feed('m.');

        const turn = (async () => {
            await moveloop_core();
            await moveloop_core();
        })();
        try {
            await dismissUntilMessage(input, turn, 'medallion begins to glow!');
            assert.equal(game.u.uhp, 0);
            assert.equal(game.uamul, amulet);
            assert.equal(game.u.acurr.a[A_CON], constitution);
            input.feed(dismissal);
        } finally {
            await dismissRecoveryPagers(input, turn, true);
        }

        assert.ok(game.u.uhp > 0);
        assert.equal(game.u.acurr.a[A_CON], constitution - 1);
        assert.equal(game.uamul, null);
        assert.equal(amulet.where, 'gone');
    });
}

void test('refusing a fatal shopkeeper attack leaves the unpaid purchase payable', async () => {
    let input = freshTurnRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    await discardMonsterInventory(shopkeeper, false);
    const purchase = await floorObject(DAGGER, 10, 10);
    await dismissRecoveryPagers(input, pickupAtHero());
    rileShopkeeper(shopkeeper);
    const price = unpaidObjectCost(purchase);
    assert.ok(price > 0);
    shopkeeper.movement = 12;
    game.flags.debug = true;
    game.u.uhp = 1;
    game.u.uhpmax = 1000;
    game.u.uac = 50;
    input = resetInputState();
    input.feed('m.');

    const turn = (async () => {
        await moveloop_core();
        await moveloop_core();
    })();
    try {
        await dismissUntilMessage(input, turn, 'Die? [yn] (n)', 'question');
        input.feed('n');
    } finally {
        await dismissRecoveryPagers(input, turn, true);
    }

    assert.ok(game.u.uhp > 0);
    assert.equal(game.u.umortality, 1);
    assert.notEqual(game.program_state.gameover, true);
    assert.equal(purchase.unpaid, true);
    assert.equal(unpaidObjectCost(purchase), price);
});

for (const species of ['shopkeeper', 'ghost']) {
    void test(`a fatal hallucinated ${species} keeper separates killer and inheritance identities`, async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop();
        await discardMonsterInventory(shopkeeper, false);
        if (species === 'ghost') {
            await changeMonsterForm(shopkeeper, MONSTER_NAME.indexOf('ghost'));
            assert.equal(shopkeeper.mnum, MONSTER_NAME.indexOf('ghost'));
            assert.ok(shopkeeper.isshk);
        }
        shopkeeper.eshk.shknam = '+InheritanceControl';
        shopkeeper.mpeaceful = false;
        shopkeeper.movement = 12;
        await addInventoryObject(DAGGER);
        game.storage = memoryStorage();
        game.flags.disclose = '-i -a -v -c -o';
        game.u.uhp = 1;
        game.u.uac = 50;
        game.u.urexp = 100;
        game.u.hallucinationTurns = 20;
        input.feed('m.');

        const turn = (async () => {
            await moveloop_core();
            await moveloop_core();
        })();
        try {
            await dismissUntilMessage(input, turn, 'all your possessions');
            const screen = visibleScreen();
            assert.match(screen, /InheritanceControl takes all your possessions/);
            assert.equal(game.program_state.gameover, true);
        } finally {
            await dismissRecoveryPagers(input, turn);
        }

        const records = loadScoreRecords(game);
        assert.ok(records[0]);
        assert.equal(records[0].outcome, 'died');
        if (species === 'ghost') {
            assert.match(records[0].death, /ghost$/);
            assert.doesNotMatch(records[0].death, /shopkeeper|InheritanceControl/);
        } else {
            assert.match(records[0].death, /^killed by (?!an? )/);
            assert.match(records[0].death, /; the shopkeeper/);
            assert.doesNotMatch(records[0].death, /InheritanceControl/);
        }
    });
}
