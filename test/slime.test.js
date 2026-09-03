import test from 'node:test';
import assert from 'node:assert/strict';

import { M_AP_MONSTER, TURNED_SLIME, W_ARM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { burnAwayHeroSlime } from '../js/hack.js';
import {
    beginHeroLifeSaving, completeHeroLifeSaving,
} from '../js/end.js';
import {
    quietMonsterActionRng, resumeDeferredHeroContact,
} from '../js/monmove.js';
import { polymonHero } from '../js/polyself.js';
import {
    AMULET_OF_LIFE_SAVING, LEATHER_ARMOR,
} from '../js/object_data.js';
import {
    advanceHeroSliming, finishDeferredHeroSlime, PM_GREEN_SLIME,
    resumeDeferredHeroSlime, startHeroSliming,
} from '../js/slime.js';
import { addMonster } from './support/monsters.js';
import { knownInventoryObject } from './support/game-objects.js';
import {
    freshHeroConditionRoom, wearHeroObject,
} from './support/hero-state.js';

test('a green slime touch infects and still deals its physical damage', () => {
    freshHeroConditionRoom();
    const slime = addMonster({
        m_id: 2080,
        mnum: PM_GREEN_SLIME,
        x: 12,
        y: 10,
        hitPoints: 20,
        level: 6,
        mux: game.u.ux,
        muy: game.u.uy,
        movement: 12,
    });
    game._deferVisibleMonsterContact = true;
    const hitPoints = game.u.uhp;

    const action = quietMonsterActionRng(
        slime,
        game,
        range => range - 1,
        () => 4,
        () => 1,
    );
    resumeDeferredHeroSlime(action, game);
    const message = action.movement.attack.slimeEffectMessage;
    finishDeferredHeroSlime(action, game);
    resumeDeferredHeroContact(action, game, range => range - 1, () => 1);

    assert.equal(message, "You don't feel very well.");
    assert.equal(game.u.slimedTurns, 10);
    assert.equal(game.u.slimeKiller, 'green slime');
    assert.equal(game.u.uhp, hitPoints - 4);
});

test('the slime countdown strips speed and interrupts the current action',
    async () => {
        freshHeroConditionRoom();
        game.u.fast = true;
        game.u.veryFast = true;
        game.u.veryFastTurns = 40;
        game._occupation = { key: 's', remaining: 12 };
        game._runState = { dx: 1, dy: 0, mode: 1 };
        game.context.run = 1;
        game.context.mv = true;
        startHeroSliming({ state: game, turns: 7, killer: 'green slime' });
        const messages = [];

        await advanceHeroSliming({
            state: game,
            publish: async message => messages.push(message),
        });

        assert.deepEqual(messages, ['Your limbs are getting oozy.']);
        assert.equal(game.u.slimedTurns, 6);
        assert.equal(game.u.fast, false);
        assert.equal(game.u.veryFast, false);
        assert.equal(game.u.veryFastTurns, 0);
        assert.equal(game._occupation, null);
        assert.equal(game._runState, null);
        assert.equal(game.context.run, 0);
    });

test('the final slime turn changes form before invoking slime death',
    async () => {
        freshHeroConditionRoom();
        startHeroSliming({ state: game, turns: 1, killer: 'green slime' });
        const armor = wearHeroObject(
            knownInventoryObject(LEATHER_ARMOR), 'uarm', W_ARM,
        );
        const amulet = knownInventoryObject(AMULET_OF_LIFE_SAVING);
        game.uamul = amulet;
        game.u.uamul = amulet;
        const messages = [];
        const deaths = [];
        const repaints = [];

        const result = await advanceHeroSliming({
            state: game,
            publish: async message => messages.push(message),
            repaint: (x, y) => repaints.push([x, y]),
            transform: polymonHero,
            die: async details => {
                deaths.push(details);
                game.u.uhp = 0;
                game.u.mh = 0;
                completeHeroLifeSaving(beginHeroLifeSaving(() => 0));
                return false;
            },
        });

        assert.deepEqual(messages, ['You have become a green slime.']);
        assert.deepEqual(repaints, [[13, 10]]);
        assert.equal(game.u.umonnum, PM_GREEN_SLIME);
        assert.ok(game.u.mh > 0);
        assert.equal(armor.where, 'gone');
        assert.equal(game.inventory.includes(amulet), false);
        assert.equal(game.u.slimedTurns, 0);
        assert.equal(game.u.m_ap_type, 0);
        assert.equal(game.u.mappearance, 0);
        assert.equal(deaths.length, 1);
        assert.equal(deaths[0].deathType, TURNED_SLIME);
        assert.equal(deaths[0].deathLineShown, true);
        assert.equal(result.transformed, true);
        assert.equal(result.died, false);
    });

test('burning slime clears its countdown, killer, and false appearance',
    async () => {
        freshHeroConditionRoom();
        startHeroSliming({ state: game, turns: 4, killer: 'green slime' });
        game.u.m_ap_type = M_AP_MONSTER;
        game.u.mappearance = PM_GREEN_SLIME;
        const messages = [];

        await burnAwayHeroSlime(
            game,
            async message => messages.push(message),
        );

        assert.deepEqual(messages, [
            'The slime that covers you is burned away!',
        ]);
        assert.equal(game.u.slimedTurns, 0);
        assert.equal(game.u.slimeKiller, undefined);
        assert.equal(game.u.m_ap_type, 0);
        assert.equal(game.u.mappearance, 0);
    });
