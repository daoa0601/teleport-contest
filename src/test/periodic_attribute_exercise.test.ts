import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { A_DEX, A_STR, A_WIS } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { woundHeroLegs } from '../js/hero_legs.js';
import { makeStunned } from '../js/hero_mental_status.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createSaddledSteed } from './support/monsters.js';
import { resetInputState } from '../js/input.js';
import { freshTurnRoom } from './support/playable-room.js';

function freshExerciseTurns() {
    const input = freshTurnRoom({ role: 'knight', heroLevel: 30 });
    requirePlayingGame(game);
    input.beforeRead = () => {
        const display = requireGameDisplay();
        const text = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (text.includes('--More--')) input.feed(' ');
    };
    game.flags.safe_wait = false;
    game.u.uhp = game.u.uhpmax = 1000;
    game.u._exercise = [0, 0, 0, 0, 0, 0];
}

async function waitFortyTurns() {
    const input = resetInputState();
    input.beforeRead = () => {
        const display = requireGameDisplay();
        const text = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (text.includes('--More--')) input.feed(' ');
        else {
            assert.equal(display.cursorCol, game.u.ux - 1);
            assert.equal(display.cursorRow, game.u.uy + 1);
            input.feed('.');
        }
    };
    const target = game.moves + 40;
    for (let action = 0; game.moves < target && action < 80; action++)
        await moveloop_core();
    assert.ok(game.moves >= target, `waiting stopped at turn ${game.moves}, expected ${target}`);
}

for (const mounted of [false, true]) {
    void test(`${mounted ? 'mounted' : 'unmounted'} wounded legs ${mounted ? 'do not abuse' : 'abuse'} Dexterity periodically`, async () => {
        freshExerciseTurns();
        requirePlayingGame(game);
        if (mounted) {
            const pony = await createSaddledSteed();
            await runExtendedCommand('ride', 'l');
            assert.equal(game.u.usteed, pony);
        }
        await woundHeroLegs('both', 100);
        assert.ok(game.u._exercise);
        game.u._exercise[A_DEX] = 0;

        await waitFortyTurns();

        if (mounted) assert.equal(game.u._exercise[A_DEX], 0);
        else assert.ok(game.u._exercise[A_DEX] < 0);
    });
}

for (const condition of ['fumbling', 'stunned']) {
    void test(`${condition} still abuses Dexterity while mounted`, async () => {
        freshExerciseTurns();
        requirePlayingGame(game);
        const pony = await createSaddledSteed();
        await runExtendedCommand('ride', 'l');
        assert.equal(game.u.usteed, pony);
        if (condition === 'fumbling') {
            const gloves = await addInventoryObject(OBJECT_NAMES.indexOf('gauntlets of fumbling'));
            await wearHeroArmor(gloves);
        } else await makeStunned(100);
        assert.ok(game.u._exercise);
        game.u._exercise[A_DEX] = 0;

        await waitFortyTurns();

        assert.ok(game.u._exercise);
        assert.ok(game.u._exercise[A_DEX] < 0);
    });
}

for (const intrinsic of [false, true]) {
    void test(`${intrinsic ? 'intrinsic' : 'worn'} regeneration ${intrinsic ? 'exercises' : 'does not exercise'} Strength`, async () => {
        freshExerciseTurns();
        requirePlayingGame(game);
        game.u.acurr.a[A_STR] = 3;
        if (intrinsic) grantIntrinsicProperty('regeneration', 'outside');
        else {
            const ring = await addInventoryObject(OBJECT_NAMES.indexOf('regeneration'));
            await wearHeroAccessory(ring, 'uleft');
        }

        await waitFortyTurns();

        assert.ok(game.u._exercise);
        if (intrinsic) assert.ok(game.u._exercise[A_STR] > 0);
        else assert.equal(game.u._exercise[A_STR], 0);
    });
}

void test('permanent clairvoyance exercises Wisdom without a timeout', async () => {
    freshExerciseTurns();
    requirePlayingGame(game);
    game.u.acurr.a[A_WIS] = 3;
    grantIntrinsicProperty('clairvoyant', 'outside');

    await waitFortyTurns();

    assert.ok(game.u._exercise);
    assert.ok(game.u._exercise[A_WIS] > 0);
});
