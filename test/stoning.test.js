import { advanceHeroPetrification } from './support/condition-turn.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { A_DEX, STONING } from '../js/const.js';
import { currentAttribute } from '../js/attrib.js';
import { woundHeroLegs } from '../js/hero_legs.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { FOOD_RATION } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { startHeroPetrification } from '../js/stoning.js';
import { freshHeroConditionRoom } from './support/hero-state.js';
void test('petrification stops actions as the hero stiffens', async () => {
    freshHeroConditionRoom();
    game.u.fast = true;
    game.u.veryFast = true;
    game.u.veryFastTurns = 30;
    const dexterity = currentAttribute(A_DEX);
    await woundHeroLegs('left', 12);
    assert.equal(currentAttribute(A_DEX), dexterity - 1);
    const ration = await addInventoryObject(FOOD_RATION);
    assert.ok(ration.invlet);
    pushKeys(ration.invlet);
    await rhack('e'.charCodeAt(0));
    startHeroPetrification({ killer: 'cockatrice egg' });
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    await advanceHeroPetrification({ state: game, publish });
    assert.equal(game.u.fast, false);
    assert.equal(game.u.stonedTurns, 4);
    assert.ok(game._occupation);
    await advanceHeroPetrification({ state: game, publish });
    assert.equal(game._occupation, null);
    await advanceHeroPetrification({ state: game, publish });
    assert.equal(game._helplessReason, 'getting stoned');
    assert.equal(game.u._woundedLegTurns, 0);
    assert.equal(currentAttribute(A_DEX), dexterity);
    assert.ok(messages.includes('You stop eating the food ration.'));
});
void test('the final petrification turn invokes a stoning death', async () => {
    freshHeroConditionRoom();
    startHeroPetrification({ turns: 1, killer: 'cockatrice egg' });
    const deaths = [];
    const result = await advanceHeroPetrification({
        state: game,
        publish: async () => { },
        die: async (details) => {
            deaths.push(details);
            return true;
        },
    });
    assert.equal(result.died, true);
    assert.equal(game.u.stonedTurns, 0);
    assert.equal(deaths[0]?.deathType, STONING);
    assert.equal(deaths[0]?.killer, 'cockatrice egg');
});
//# sourceMappingURL=stoning.test.js.map