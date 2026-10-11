import type { DeathHandler } from '../js/end.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { M_AP_MONSTER, TURNED_SLIME } from '../js/const.js';
import { game } from '../js/gstate.js';
import { burnAwayHeroSlime } from '../js/hack.js';
import {
    beginHeroLifeSaving, completeHeroLifeSaving,
} from '../js/end.js';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { pushKeys } from '../js/input.js';
import { polymonHero } from '../js/polyself.js';
import {
    AMULET_OF_LIFE_SAVING, LEATHER_ARMOR,
} from '../js/object_data.js';
import {
    advanceHeroSliming, PM_GREEN_SLIME, startHeroSliming,
} from '../js/slime.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshHeroConditionRoom } from './support/hero-state.js';
import { freshTurnRoom } from './support/playable-room.js';
import { wearHeroArmor } from '../js/armor.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { flushPendingTopline } from '../js/display.js';

void test('a green slime touch infects and still deals its physical damage', async () => {
    freshTurnRoom();
    requirePlayingGame(game);
    const slime = await createMonsterAt('green slime', 11, 10);
    slime.mpeaceful = false;
    slime.movement = 12;
    const hitPoints = game.u.uhp;
    pushKeys('m.                                m.');

    await moveloop_core();
    await moveloop_core();

    assert.ok(game.u.slimedTurns != null, 'Expected game.u.slimedTurns to be initialized');
    assert.ok(game.u.slimedTurns > 0 && game.u.slimedTurns <= 10);
    assert.equal(game.u.slimeKiller, 'green slime');
    assert.ok(game.u.uhp < hitPoints);
});

for (const activity of ['12s', 'L']) {
    void test(`the slime countdown strips speed and interrupts ${activity}`, async () => {
        freshHeroConditionRoom();
        game.u.fast = true;
        game.u.veryFast = true;
        game.u.veryFastTurns = 40;
        pushKeys(activity);
        await rhack(0);
        startHeroSliming({ state: game, turns: 7, killer: 'green slime' });
        const messages: string[] = [];

        await advanceHeroSliming({
            state: game,
            publish: async message => { messages.push(message); },
        });

        assert.equal(messages[0], 'Your limbs are getting oozy.');
        if (activity === '12s') assert.ok(messages.includes('You stop searching.'));
        assert.equal(game.u.slimedTurns, 6);
        assert.equal(game.u.fast, false);
        assert.equal(game.u.veryFast, false);
        assert.equal(game.u.veryFastTurns, 0);
        assert.ok(!game._occupation);
        assert.ok(!game._runState);
        assert.equal(game.context.run, 0);
    });
}

void test('the final slime turn changes form before invoking slime death',
    async () => {
        freshHeroConditionRoom();
        startHeroSliming({ state: game, turns: 1, killer: 'green slime' });
        const armor = await addInventoryObject(LEATHER_ARMOR);
        wearHeroArmor(armor);
        const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
        await wearHeroAccessory(amulet, 'uamul');
        pushKeys(' ');
        await flushPendingTopline();
        const messages: string[] = [];
        const deaths: Parameters<DeathHandler>[0][] = [];
        const repaints: [number, number][] = [];

        const result = await advanceHeroSliming({
            state: game,
            publish: async message => { messages.push(message); },
            repaint: (x, y) => { repaints.push([x, y]); },
            transform: polymonHero,
            die: async details => {
                deaths.push(details);
                game.u.uhp = 0;
                game.u.mh = 0;
                await completeHeroLifeSaving(beginHeroLifeSaving(() => 0));
                return false;
            },
        });

        assert.deepEqual(messages, ['You have become a green slime.']);
        assert.deepEqual(repaints, [[13, 10]]);
        assert.equal(game.u.umonnum, PM_GREEN_SLIME);
        assert.ok(game.u.mh != null, 'Expected game.u.mh to be initialized');
        assert.ok(game.u.mh > 0);
        assert.equal(armor.where, 'gone');
        assert.equal(game.inventory.includes(amulet), false);
        assert.equal(game.u.slimedTurns, 0);
        assert.equal(game.u.m_ap_type, 0);
        assert.equal(game.u.mappearance, 0);
        assert.equal(deaths.length, 1);
        assert.equal(deaths[0]?.deathType, TURNED_SLIME);
        assert.equal(deaths[0]?.deathLineShown, true);
        assert.equal(result.transformed, true);
        assert.equal(result.died, false);
    });

void test('burning slime clears its countdown, killer, and false appearance',
    async () => {
        freshHeroConditionRoom();
        startHeroSliming({ state: game, turns: 4, killer: 'green slime' });
        game.u.m_ap_type = M_AP_MONSTER;
        game.u.mappearance = PM_GREEN_SLIME;
        const messages: string[] = [];

        await burnAwayHeroSlime(
            game,
            async message => { messages.push(message); },
        );

        assert.deepEqual(messages, [
            'The slime that covers you is burned away!',
        ]);
        assert.equal(game.u.slimedTurns, 0);
        assert.equal(game.u.slimeKiller, undefined);
        assert.equal(game.u.m_ap_type, 0);
        assert.equal(game.u.mappearance, 0);
    });
