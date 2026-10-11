import { memoryStorage } from './support/memory-storage.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { currentConductLines } from '../js/insight.js';
import { runSegment } from '../js/jsmain.js';
import { finishStartingDiscoveries, uInitInventoryAttrs, } from '../js/u_init.js';
import { screenText } from './support/screen.js';
import { prepareHeroStartup } from './support/startup.js';
async function wizardCandidate(seed = 8271n) {
    prepareHeroStartup({
        role: 'wizard',
        alignment: 'neutral',
        flags: { reroll: true },
        seed,
    });
    assert.equal(await uInitInventoryAttrs(), true);
    return game;
}
void test('disposable candidates defer equipment, spells, discoveries, and skills', async () => {
    const state = await wizardCandidate();
    const firstIds = new Set(state.inventory.map(item => item.o_id));
    assert.ok(!state.uwep);
    assert.ok(!state.uarmc);
    assert.deepEqual(state.spells, []);
    assert.equal(state.u.weaponSkills, null);
    assert.equal(state._encounteredObjectTypes?.size || 0, 0);
    assert.equal(await uInitInventoryAttrs(), true);
    assert.equal(state.inventory.some(item => firstIds.has(item.o_id)), false);
    assert.ok(!state.uwep);
    assert.deepEqual(state.spells, []);
    assert.equal(state.u.weaponSkills, null);
    assert.equal(state._encounteredObjectTypes?.size || 0, 0);
    const initialPower = state.u.uenmax;
    assert.equal(await finishStartingDiscoveries(), true);
    assert.ok(state.uwep);
    assert.ok(state.spells.length > 0);
    assert.ok(state.u.weaponSkills);
    assert.ok(initialPower != null, 'Expected initialPower to be initialized');
    if (initialPower < 5)
        assert.equal(state.u.ueninc?.[1], 5);
    assert.ok(state._encounteredObjectTypes != null, 'Expected state._encounteredObjectTypes to be initialized');
    assert.ok(state._encounteredObjectTypes.size > 0);
    assert.equal(await finishStartingDiscoveries(), false);
});
void test('fresh startup rerolls once and accepts the final candidate', async () => {
    const result = await runSegment({
        seed: 8272,
        datetime: '20260829162500',
        nethackrc: [
            'OPTIONS=name:Reroller,role:Wizard,race:human,gender:male,align:neutral',
            'OPTIONS=reroll,!legacy,!tutorial,!autopickup,pettype:none',
        ].join('\n'),
        moves: 'rp.',
        storage: memoryStorage(),
    });
    requirePlayingGame(game);
    const screens = result.getScreens().map(screenText);
    assert.ok(screens[0] !== undefined && screens[1] !== undefined);
    assert.match(screens[0], /Reroll this character\?/);
    assert.match(screens[0], /p - start the game with this character/);
    assert.match(screens[0], /r - reroll another character/);
    assert.match(screens[0], /St:\S+ Dx:\d+ Co:\d+ In:\d+ Wi:\d+ Ch:\d+/);
    assert.doesNotMatch(screens[0], /weapon in hands|being worn/);
    assert.match(screens[1], /Reroll this character\?/);
    assert.notEqual(screens[0], screens[1]);
    assert.equal(game.u.uroleplay.reroll, true);
    assert.equal(game.u.uroleplay.numrerolls, 1);
    assert.ok(game.uwep);
    assert.ok(game.spells.length > 0);
    assert.ok(game.u.weaponSkills);
    assert.ok(currentConductLines().includes(' Your character was rerolled once.'));
});
void test('closing the menu uses the source yes-no fallback without spending a turn', async () => {
    const result = await runSegment({
        seed: 8274,
        datetime: '20260829162700',
        nethackrc: [
            'OPTIONS=name:Cancel,role:Wizard,race:human,gender:male,align:neutral',
            'OPTIONS=reroll,!legacy,!tutorial,!autopickup,pettype:none',
        ].join('\n'),
        moves: '\x1b\x1b.',
        storage: memoryStorage(),
    });
    requirePlayingGame(game);
    const screens = result.getScreens().map(screenText);
    assert.ok(screens[0] !== undefined && screens[1] !== undefined);
    assert.match(screens[0], /Reroll this character\?/);
    assert.match(screens[1], /Reroll this character\? \[yn\] \(n\)/);
    assert.equal(game.u.uroleplay.numrerolls, 0);
    assert.ok(currentConductLines().includes(' Your character was not rerolled.'));
});
void test('lootabc assigns automatic menu letters without changing reroll state', async () => {
    const result = await runSegment({
        seed: 8273,
        datetime: '20260829162600',
        nethackrc: [
            'OPTIONS=name:Alphabet,role:Ranger,race:gnome,gender:female,align:neutral',
            'OPTIONS=reroll,lootabc,!legacy,!tutorial,!autopickup,pettype:none',
        ].join('\n'),
        moves: 'ba.',
        storage: memoryStorage(),
    });
    requirePlayingGame(game);
    const screens = result.getScreens().map(screenText);
    assert.ok(screens[0] !== undefined && screens[1] !== undefined);
    assert.match(screens[0], /a - start the game with this character/);
    assert.match(screens[0], /b - reroll another character/);
    assert.match(screens[1], /a - start the game with this character/);
    assert.equal(game.u.uroleplay.numrerolls, 1);
});
//# sourceMappingURL=startup_reroll.test.js.map