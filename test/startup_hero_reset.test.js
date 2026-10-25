import assert from 'node:assert/strict';
import test from 'node:test';
import { currentConductLines } from '../js/insight.js';
import { propertyIsActive, setPropertyTimeout } from '../js/properties.js';
import { heroIsHallucinating } from '../js/senses.js';
import { uInitMisc } from '../js/u_init.js';
import { prepareHeroStartup } from './support/startup.js';
void test('initializing a new hero discards the previous hero status timeouts', () => {
    const state = prepareHeroStartup({ role: 'wizard' });
    setPropertyTimeout('fast', 40, state);
    setPropertyTimeout('hallucination', 60, state);
    assert.equal(propertyIsActive('fast', state), true);
    assert.equal(heroIsHallucinating(state), true);
    uInitMisc(1);
    assert.equal(propertyIsActive('fast', state), false, 'the new Wizard must not inherit temporary speed');
    assert.equal(heroIsHallucinating(state), false, 'the new hero must see the dungeon without the previous hallucination');
});
void test('hero initialization preserves the roleplay record that C excludes from its reset', () => {
    const state = prepareHeroStartup({ role: 'wizard', flags: { reroll: true } });
    assert.ok(state.u.uroleplay);
    state.u.uroleplay.numrerolls = 2;
    state.u.uroleplay.numbones = 3;
    uInitMisc(1);
    assert.ok(currentConductLines().includes(' Your character was rerolled twice.'));
    assert.equal(state.u.uroleplay?.numbones, 3, 'hero initialization preserves the bones-level count with the other roleplay fields');
});
//# sourceMappingURL=startup_hero_reset.test.js.map